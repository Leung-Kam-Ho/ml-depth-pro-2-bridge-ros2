//
// For licensing see accompanying LICENSE file.
// Copyright (C) 2026 Apple Inc. All Rights Reserved.
//

import Darwin
import Foundation

struct APIRequest: Sendable {
    let method: String
    let path: String
    let body: Data
}

struct APIResponse: Sendable {
    let status: Int
    let body: Data

    init(_ status: Int, json: [String: Any]) {
        self.status = status
        body = (try? JSONSerialization.data(withJSONObject: json, options: [.sortedKeys])) ?? Data("{}".utf8)
    }
}

/// A small HTTP/1.1 server bound to the configured IPv4 address.
final class APIServer: @unchecked Sendable {
    typealias Handler = @Sendable (APIRequest, @escaping @Sendable (APIResponse) -> Void) -> Void

    private let listener: Int32
    private let queue = DispatchQueue(label: "demo.api")
    private let handler: Handler
    private let lock = NSLock()
    private var stopped = false

    init(host: String, port: UInt16, handler: @escaping Handler) throws {
        self.handler = handler
        listener = Darwin.socket(AF_INET, SOCK_STREAM, 0)
        guard listener >= 0 else { throw Self.socketError("create API socket") }

        var address = sockaddr_in()
        address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
        address.sin_family = sa_family_t(AF_INET)
        address.sin_port = port.bigEndian
        guard inet_pton(AF_INET, host, &address.sin_addr) == 1 else {
            Darwin.close(listener)
            throw DemoError("invalid API IPv4 bind address: \(host)")
        }
        let bound = withUnsafePointer(to: &address) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                Darwin.bind(listener, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
            }
        }
        guard bound == 0 else {
            let error = Self.socketError("bind API to \(host):\(port)")
            Darwin.close(listener)
            throw error
        }
        guard Darwin.listen(listener, SOMAXCONN) == 0 else {
            let error = Self.socketError("listen for API connections")
            Darwin.close(listener)
            throw error
        }
    }

    func start() { queue.async { self.acceptConnections() } }

    func stop() {
        lock.lock()
        let shouldClose = !stopped
        stopped = true
        lock.unlock()
        if shouldClose {
            Darwin.shutdown(listener, SHUT_RDWR)
            Darwin.close(listener)
        }
    }

    private var isStopped: Bool {
        lock.lock()
        defer { lock.unlock() }
        return stopped
    }

    private func acceptConnections() {
        while !isStopped {
            let client = Darwin.accept(listener, nil, nil)
            if client < 0 {
                if isStopped { return }
                if errno == EINTR { continue }
                note("API accept failed: \(String(cString: strerror(errno)))")
                continue
            }
            var noSigPipe: Int32 = 1
            _ = setsockopt(client, SOL_SOCKET, SO_NOSIGPIPE, &noSigPipe, socklen_t(MemoryLayout<Int32>.size))
            DispatchQueue.global(qos: .userInitiated).async { self.handle(client) }
        }
    }

    private func handle(_ client: Int32) {
        var bytes = Data()
        var buffer = [UInt8](repeating: 0, count: 16_384)
        while bytes.count <= 65_536 {
            let count = buffer.withUnsafeMutableBytes { raw in
                Darwin.recv(client, raw.baseAddress, raw.count, 0)
            }
            if count == 0 { close(client); return }
            if count < 0 {
                if errno == EINTR { continue }
                close(client)
                return
            }
            bytes.append(contentsOf: buffer.prefix(count))
            switch Self.parse(bytes) {
            case .request(let request):
                handler(request) { response in Self.send(response, to: client) }
                return  // The response callback owns closing the client socket.
            case .invalid(let status):
                Self.send(APIResponse(status, json: ["error": status == 413 ? "request too large" : "invalid HTTP request"]), to: client)
                return
            case .incomplete:
                continue
            }
        }
        Self.send(APIResponse(413, json: ["error": "request too large"]), to: client)
    }

    private func close(_ client: Int32) {
        Darwin.shutdown(client, SHUT_RDWR)
        Darwin.close(client)
    }

    private enum ParseResult {
        case request(APIRequest)
        case invalid(Int)
        case incomplete
    }

    private static func parse(_ data: Data) -> ParseResult {
        guard let separator = data.range(of: Data("\r\n\r\n".utf8)) else {
            return data.count > 65_536 ? .invalid(413) : .incomplete
        }
        guard let headerText = String(data: data[..<separator.lowerBound], encoding: .utf8) else { return .invalid(400) }
        let lines = headerText.components(separatedBy: "\r\n")
        guard let first = lines.first else { return .invalid(400) }
        let parts = first.split(separator: " ")
        guard parts.count == 3, parts[2].hasPrefix("HTTP/1."), let path = parts.dropFirst().first else {
            return .invalid(400)
        }
        var contentLength = 0
        for line in lines.dropFirst() {
            let header = line.split(separator: ":", maxSplits: 1, omittingEmptySubsequences: false)
            if header.count == 2, header[0].trimmingCharacters(in: .whitespaces).lowercased() == "content-length" {
                guard let length = Int(header[1].trimmingCharacters(in: .whitespaces)), length >= 0 else {
                    return .invalid(400)
                }
                contentLength = length
            }
        }
        guard contentLength <= 60_000 else { return .invalid(413) }
        let bodyStart = separator.upperBound
        guard data.count - bodyStart >= contentLength else { return .incomplete }
        let target = String(path)
        let apiPath = target.split(separator: "?", maxSplits: 1).first.map(String.init) ?? target
        return .request(APIRequest(
            method: String(parts[0]), path: apiPath,
            body: Data(data[bodyStart..<(bodyStart + contentLength)])))
    }

    private static func send(_ response: APIResponse, to client: Int32) {
        let reason: String
        switch response.status {
        case 200: reason = "OK"
        case 202: reason = "Accepted"
        case 400: reason = "Bad Request"
        case 404: reason = "Not Found"
        case 405: reason = "Method Not Allowed"
        case 409: reason = "Conflict"
        case 413: reason = "Payload Too Large"
        case 422: reason = "Unprocessable Entity"
        default: reason = "Internal Server Error"
        }
        var bytes = Data("HTTP/1.1 \(response.status) \(reason)\r\nContent-Type: application/json; charset=utf-8\r\nConnection: close\r\nContent-Length: \(response.body.count)\r\n\r\n".utf8)
        bytes.append(response.body)
        bytes.withUnsafeBytes { raw in
            guard let base = raw.baseAddress else { return }
            var sent = 0
            while sent < raw.count {
                let count = Darwin.send(client, base.advanced(by: sent), raw.count - sent, 0)
                if count <= 0 {
                    if count < 0, errno == EINTR { continue }
                    break
                }
                sent += count
            }
        }
        Darwin.shutdown(client, SHUT_RDWR)
        Darwin.close(client)
    }

    private static func socketError(_ operation: String) -> DemoError {
        DemoError("\(operation): \(String(cString: strerror(errno)))")
    }
}
