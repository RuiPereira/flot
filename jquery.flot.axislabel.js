/*
Flot plugin for labeling axis

    (xy)axis: {
        label: "label string",
        labelPos: "high" or "low"
    }

This plugin allows you to label an axis, by replacing one of the extreme ticks
with the chosen label string. Set labelPos to "high" or "low" to replace
respectively the maximum or the minimum value of the ticks.

Rui Pereira
rui (dot) pereira (at) gmail (dot) com
*/
(function ($) {

    function labelAxis(val, axis){
        var ticks;
        if (axis.options.autoscaleMargin == null || (axis.options.min != null) || (axis.options.max != null))
            // cut ticks not seen
            ticks = $.map(axis.tickGenerator(axis), function(v){
                if (v > axis.min && v < axis.max) return v;
            });
        // standard tick generator
        else ticks = axis.tickGenerator(axis);

        // in Y with reclined labels or inverted axis put the title on the lowest one
        if (typeof axis.options.label != 'undefined' && axis.options.label != null
                && ((axis.options.labelPos == 'high' && val == ticks[ticks.length-1]) ||
                (axis.options.labelPos == 'low' && val == ticks[0])))
            return axis.options.label;
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
