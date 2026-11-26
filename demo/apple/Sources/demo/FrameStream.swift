//
// For licensing see accompanying LICENSE file.
// Copyright (C) 2026 Apple Inc. All Rights Reserved.
//

import CoreVideo
import Darwin
import Foundation
import Metal

/// Streams the newest aligned RGB/depth frame to one connected ROS 2 bridge.
final class FrameStreamServer: @unchecked Sendable {
    private let listener: Int32
    private let queue = DispatchQueue(label: "demo.frame-stream")
    private let condition = NSCondition()
    private let stateLock = NSLock()
    private var stopped = false
    private var activeClient: Int32 = -1
    private var latestFrame: Data?
    private var sequence = 0

    deinit { stop() }

    init(host: String, port: UInt16) throws {
        listener = Darwin.socket(AF_INET, SOCK_STREAM, 0)
        guard listener >= 0 else { throw Self.socketError("create frame-stream socket") }
        var address = sockaddr_in()
        address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
        address.sin_family = sa_family_t(AF_INET)
        address.sin_port = port.bigEndian
        guard inet_pton(AF_INET, host, &address.sin_addr) == 1 else {
            Darwin.close(listener)
            throw DemoError("invalid frame-stream IPv4 bind address: \(host)")
        }
        let bound = withUnsafePointer(to: &address) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                Darwin.bind(listener, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
            }
        }
        guard bound == 0 else {
            let error = Self.socketError("bind frame stream to \(host):\(port)")
            Darwin.close(listener)
            throw error
        }
        guard Darwin.listen(listener, 1) == 0 else {
            let error = Self.socketError("listen for frame-stream connections")
            Darwin.close(listener)
            throw error
        }
    }

    func start() { queue.async { self.acceptConnections() } }

    func stop() {
        stateLock.lock()
        let shouldClose = !stopped
        stopped = true
        let client = activeClient
        activeClient = -1
        stateLock.unlock()
        if shouldClose {
            Darwin.shutdown(listener, SHUT_RDWR)
            Darwin.close(listener)
            if client >= 0 { Darwin.shutdown(client, SHUT_RDWR) }
            condition.lock()
            condition.broadcast()
            condition.unlock()
        }
    }

    var hasSubscriber: Bool {
        stateLock.lock()
        defer { stateLock.unlock() }
        return activeClient >= 0 && !stopped
    }

    /// Called only when a bridge is connected; replacing the pending frame drops stale frames.
    func publish(inverseDepth: CVPixelBuffer, color: MTLTexture, metricScale: Float, captureUnixTime: Double) {
        guard hasSubscriber,
            let packet = Self.packet(
                inverseDepth: inverseDepth, color: color, metricScale: metricScale,
                captureUnixTime: captureUnixTime)
        else { return }
        condition.lock()
        latestFrame = packet
        sequence += 1
        condition.signal()
        condition.unlock()
    }

    private func acceptConnections() {
        while !isStopped {
            let client = Darwin.accept(listener, nil, nil)
            if client < 0 {
                if isStopped { return }
                if errno == EINTR { continue }
                note("frame-stream accept failed: \(String(cString: strerror(errno)))")
                continue
            }
            var noSigPipe: Int32 = 1
            _ = setsockopt(client, SOL_SOCKET, SO_NOSIGPIPE, &noSigPipe, socklen_t(MemoryLayout<Int32>.size))
            var timeout = timeval(tv_sec: 1, tv_usec: 0)
            _ = setsockopt(client, SOL_SOCKET, SO_SNDTIMEO, &timeout, socklen_t(MemoryLayout<timeval>.size))
            stateLock.lock()
            activeClient = client
            stateLock.unlock()
            streamFrames(to: client)
            stateLock.lock()
            if activeClient == client { activeClient = -1 }
            stateLock.unlock()
            Darwin.shutdown(client, SHUT_RDWR)
            Darwin.close(client)
        }
    }

    private var isStopped: Bool {
        stateLock.lock()
        defer { stateLock.unlock() }
        return stopped
    }

    private func streamFrames(to client: Int32) {
        var sentSequence = 0
        while !isStopped {
            condition.lock()
            while sequence == sentSequence && !isStopped { condition.wait() }
            let frame = latestFrame
            let currentSequence = sequence
            condition.unlock()
            guard let frame else { continue }
            guard Self.send(frame, to: client) else { return }
            sentSequence = currentSequence
        }
    }

    private static func packet(
        inverseDepth: CVPixelBuffer, color: MTLTexture, metricScale: Float, captureUnixTime: Double
    ) -> Data? {
        let width = CVPixelBufferGetWidth(inverseDepth)
        let height = CVPixelBufferGetHeight(inverseDepth)
        guard color.width == width, color.height == height,
            CVPixelBufferLockBaseAddress(inverseDepth, .readOnly) == kCVReturnSuccess
        else { return nil }
        defer { CVPixelBufferUnlockBaseAddress(inverseDepth, .readOnly) }
        guard let base = CVPixelBufferGetBaseAddress(inverseDepth) else { return nil }

        var bgra = [UInt8](repeating: 0, count: width * height * 4)
        bgra.withUnsafeMutableBytes { raw in
            color.getBytes(
                raw.baseAddress!, bytesPerRow: width * 4,
                from: MTLRegionMake2D(0, 0, width, height), mipmapLevel: 0)
        }
        var rgb = Data(count: width * height * 3)
        rgb.withUnsafeMutableBytes { raw in
            let output = raw.bindMemory(to: UInt8.self)
            for pixel in 0..<(width * height) {
                output[pixel * 3] = bgra[pixel * 4 + 2]
                output[pixel * 3 + 1] = bgra[pixel * 4 + 1]
                output[pixel * 3 + 2] = bgra[pixel * 4]
            }
        }

        var depths = [Float](repeating: .nan, count: width * height)
        let rowBytes = CVPixelBufferGetBytesPerRow(inverseDepth)
        for y in 0..<height {
            let row = (base + y * rowBytes).assumingMemoryBound(to: Float16.self)
            for x in 0..<width {
                let inverse = Float(row[x])
                if inverse.isFinite, inverse > 0 {
                    depths[y * width + x] = metricScale / inverse
                }
            }
        }
        let depthBytes = depths.withUnsafeBytes { Data($0) }
        let fx = Double(metricScale) * Double(width)
        let header: [String: Any] = [
            "width": width, "height": height,
            "fx": fx, "fy": fx,
            "cx": Double(width - 1) / 2, "cy": Double(height - 1) / 2,
            "stamp_unix": captureUnixTime,
            "frame_id": "camera_optical_frame",
            "rgb_encoding": "rgb8", "depth_encoding": "32FC1-le",
        ]
        guard let headerData = try? JSONSerialization.data(withJSONObject: header) else { return nil }
        var body = Data()
        body.appendUInt32(UInt32(headerData.count))
        body.append(headerData)
        body.append(rgb)
        body.append(depthBytes)
        var packet = Data()
        packet.appendUInt32(UInt32(body.count))
        packet.append(body)
        return packet
    }

    private static func send(_ data: Data, to client: Int32) -> Bool {
        data.withUnsafeBytes { raw in
            guard let base = raw.baseAddress else { return false }
            var sent = 0
            while sent < raw.count {
                let count = Darwin.send(client, base.advanced(by: sent), raw.count - sent, 0)
                if count <= 0 {
                    if count < 0, errno == EINTR { continue }
                    return false
                }
                sent += count
            }
            return true
        }
    }

    private static func socketError(_ operation: String) -> DemoError {
        DemoError("\(operation): \(String(cString: strerror(errno)))")
    }
}

private extension Data {
    mutating func appendUInt32(_ value: UInt32) {
        var bigEndian = value.bigEndian
        Swift.withUnsafeBytes(of: &bigEndian) { append(contentsOf: $0) }
    }
}
