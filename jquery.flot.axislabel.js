/*
Flot plugin for labeling axis

    (xy)axis: {
        label: "label string",
        labelPos: "high" or "low"
    }

This plugin allows you to label an axis, by replacing one of the extreme ticks
with the chosen label string. Set labelPos to "high" or "low" to replace
respectively the maximum or the minimum value of the ticks.

It forces the tickFormatter for now, maybe I'll find something more inteligent later on.
It does *not* work for axis with mode == 'time'.

Rui Pereira
rui (dot) pereira (at) gmail (dot) com
*/
(function ($) {

    // copied from flot 0.7
    function timeformatter(v, axis) {
        // map of app. size of time units in milliseconds
        var timeUnitSize = {
            "second": 1000,
            "minute": 60 * 1000,
            "hour": 60 * 60 * 1000,
            "day": 24 * 60 * 60 * 1000,
            "month": 30 * 24 * 60 * 60 * 1000,
            "year": 365.2425 * 24 * 60 * 60 * 1000
        };

        var d = new Date(v), fmt, opts = axis.options;

        // first check global format
        if (opts.timeformat != null)
            return $.plot.formatDate(d, opts.timeformat, opts.monthNames);

        var t = axis.tickSize[0] * timeUnitSize[axis.tickSize[1]];
        var span = axis.max - axis.min;
        var suffix = (opts.twelveHourClock) ? " %p" : "";

        if (t < timeUnitSize.minute)
            fmt = "%h:%M:%S" + suffix;
        else if (t < timeUnitSize.day) {
            if (span < 2 * timeUnitSize.day)
                fmt = "%h:%M" + suffix;
            else
                fmt = "%b %d %h:%M" + suffix;
        }
        else if (t < timeUnitSize.month)
            fmt = "%b %d";
        else if (t < timeUnitSize.year) {
            if (span < timeUnitSize.year)
                fmt = "%b";
            else
                fmt = "%b %y";
        }
        else
            fmt = "%y";

        return $.plot.formatDate(d, fmt, opts.monthNames);
    }

    function labelAxis(val, axis){
        var ticks, opts = axis.options;

        // time mode - copy default time formatter from flot 0.7
        if (opts.mode == 'time') return timeformatter(val, axis);
        // generator
        else if (opts.autoscaleMargin == null || opts.min != null || opts.max != null)
            // cut ticks not seen
            ticks = $.map(axis.tickGenerator(axis), function(v){
                if (v > axis.min && v < axis.max) return v;
            });
        // standard tick generator
        else ticks = axis.tickGenerator(axis);

        // formatter
        if (typeof opts.label != 'undefined' && opts.label != null
                && ((opts.labelPos == 'high' && val == ticks[ticks.length-1]) ||
                (opts.labelPos == 'low' && val == ticks[0])))
            return opts.label;
        else {
            // scientific notation for small values
            if (axis.datamin < 1e-5) return val.toPrecision(2);
            else return val.toFixed(axis.tickDecimals);
        }
    }

    var options = { xaxis: {label: null, labelPos: 'high', tickFormatter: labelAxis},
                    yaxis: {label: null, labelPos: 'high', tickFormatter: labelAxis}
    };

    $.plot.plugins.push({
                init: $.noop,
                options: options,
                name: "axislabel",
                version: "0.1"
            });
})(jQuery);
