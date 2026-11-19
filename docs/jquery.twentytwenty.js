// TwentyTwenty before/after slider, adapted for video (after the ProPainter project page).
// Horizontal only. The handle takes the drag (sliderInput in ui.js).

(function($){

    $.fn.twentytwenty = function(options) {
        var options = $.extend({
            default_offset_pct: 0.5,
            before_label: '',
            after_label: '',
            ratio: 1.0
        }, options);

        return this.each(function() {
            var container = $(this);
            var sliderPct = options.default_offset_pct;
            var ratio = options.ratio;

            container.wrap("<div class='twentytwenty-wrapper'></div>");
            container.append("<div class='twentytwenty-overlay'></div>");
            var overlay = container.find(".twentytwenty-overlay");
            overlay.append($("<div class='twentytwenty-before-label'></div>").text(options.before_label));
            overlay.append($("<div class='twentytwenty-after-label'></div>").text(options.after_label));
            var beforeImg = container.find(".video:first");
            var afterImg = container.find(".video:last");
            container.append("<div class='twentytwenty-handle'></div>");
            var slider = container.find(".twentytwenty-handle");
            slider.append("<span class='twentytwenty-left-arrow'></span>");
            slider.append("<span class='twentytwenty-right-arrow'></span>");
            container.addClass("twentytwenty-container");
            beforeImg.addClass("twentytwenty-before");
            afterImg.addClass("twentytwenty-after");

            var adjustSlider = function(pct) {
                var w = container.width();
                var cw = pct * w;
                slider.css("left", cw + "px");
                var beforeClip = "inset(0px " + (w - cw) + "px 0px 0px)";
                var afterClip = "inset(0px 0px 0px " + cw + "px)";
                beforeImg.css("clip-path", beforeClip);
                afterImg.css("clip-path", afterClip);
                container.css("height", (w * ratio) + "px");
                // Hide a side label when the handle covers it (coverLabels is in ui.js).
                coverLabels(container.find(".twentytwenty-before-label")[0], container.find(".twentytwenty-after-label")[0], cw);
                container.trigger("slid.twentytwenty", [pct]);
            };

            // Move the handle from outside, e.g. from a button: container.trigger("slideto.twentytwenty", [pct]).
            container.on("slideto.twentytwenty", function(e, pct) {
                sliderPct = pct;
                adjustSlider(sliderPct);
            });

            // Size it again after the page changes its width: container.trigger("refit.twentytwenty").
            container.on("refit.twentytwenty", function() {
                adjustSlider(sliderPct);
            });

            sliderInput(container, function(pct) {  // ui.js
                sliderPct = pct;
                adjustSlider(sliderPct);
            });

            adjustSlider(sliderPct);
        });
    };

})(jQuery);
