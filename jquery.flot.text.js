/**
 * Flot plugin for drawing text (ticks, values, legends, etc...) directly on FLOT's canvas context
 * Released by Andre Lessa, September 2010, v.0.1
 * http://www.lessaworld.com/projects/flotCanvasText
 *
 * adapted for flot 0.7 by Rui Pereira (rui.pereira@gmail.com) using native ctx html5 functions
 */

(function ($) {
    var options = {
        grid: {
            canvasText: {
                show: false,
                font: "12px sans-serif",
                lineBreaks: {show: false, marginTop: 3, marginBottom: 5, lineSpacing: 1}
            }
        }
    };

    function init(plot) {

        /**
        * Adds the new text-related functions to the Flot canvas context (ctx)
        */
        function enableCanvasText(plot, ctx) {
            var options = plot.getOptions();
            var placeholder = plot.getPlaceholder();

            /**
             * Check if the user has requested canvas-based text support
             * If not, the HTML text is not removed from the web page
             */
            if (options.grid.canvasText.show) {
                ctx.font = options.grid.canvasText.font;
                ctx.fontAscent = function() {
                    return parseInt(ctx.font.match(/[0-9]?[0-9](?=px)/gi));
                };
                if (options.grid.show) {
                    /**
                     * Remove any div-based tickLabels from the page
                     */
                    placeholder.find(".tickLabel").remove();
                    plot.insertLabelsCanvasText(ctx);
                }

                /**
                 * Remove any table-based legendLabels from the page.
                 * .remove() is not being used because we don't want to remove the TD element.
                 * We want to maintain the original width to guarantee enough room for the new text.
                 * Note that the canvas-based legend text is only drawn when a legend container is not provided.
                 * Although FLOT's original implementation allows the legend to show up anywhere on the page,
                 * this implementation (so far) only allows the legend to be created on the canvas context.
                 */
                if (options.legend.container == null) {
                    placeholder.find(".legendLabel").each(function(i, el) {
                        el = $(el);
                        var elWidth = el.width();
                        el.text("");
                        el.width(elWidth);
                    });
                    placeholder.find(".legend").remove();
                    plot.insertLegendCanvasText(ctx);
                }
            }
        }
        
        /**
        * This is the modified version of FLOT's insertLabels function.
        */  
        var hasCSS3transform = false;
        plot.insertLabelsCanvasText = function (ctx) {
            var options = plot.getOptions();
            var axes = plot.getAxes();
            var plotOffset = plot.getPlotOffset();
            var plotHeight = plot.height();

            //figure out whether the browser supports CSS3 2d transforms
            //for label angle, logic borrowed from Modernizr
            var transform = undefined,addRotateLabelStyles = function () {},
            props = [ 'transformProperty', 'WebkitTransform', 'MozTransform', 'OTransform', 'msTransform' ],
            prefix = [ '', '-webkit-', '-moz-', '-o-', '-ms-' ],
            testEl = document.createElement('flotelement');

            for ( var i in props) {
                if ( testEl.style[ props[i] ] !== undefined ) {
                    transform = prefix[i];
                    break;
                }
            }

            if (transform != undefined) { //use CSS3 2d transforms
                hasCSS3transform = true;
                addRotateLabelStyles = function(styles,axis){
                    //flip the angle so CSS3 and Filter work the same way
                    styles.push(transform+"transform:rotate("+-axis.options.labelAngle+"deg)");
                    styles.push(transform+"transform-origin:top left");
                }
            } else if (typeof testEl.style.filter == 'string' ||
                       typeof testEl.style.filters == 'object') { //IE without 2d transforms
                addRotateLabelStyles = function(styles,axis) {
                    var rad = axis.options.labelAngle * Math.PI / 180,
                    cos = Math.cos(rad),
                    sin = Math.sin(rad);

                    styles.push("filter:progid:DXImageTransform.Microsoft.Matrix(M11="+cos+", M12="+sin+", M21="+(-sin)+", M22="+cos+",sizingMethod='auto expand'");
                }
            }

            ctx.strokeStyle = options.grid.color;

            function addLabels(axis, labelGenerator) {
                if(typeof axis.ticks != 'undefined') 
                    for (var i = 0; i < axis.ticks.length; ++i) {
                        var tick = axis.ticks[i];
                        if (!tick.label || tick.v < axis.min || tick.v > axis.max)
                            continue;
                        labelGenerator(tick, axis);
                    }
            }

            var margin = options.grid.labelMargin + options.grid.borderWidth;

            addLabels(axes.xaxis, function (tick, axis) {
                var label = tick.label;
                var labels;
                var x, y;
                /**
                * If user requests, tick labels are displayed one word per line
                */
                labels = (options.grid.canvasText.lineBreaks.show)?label.split(" "):[label];
                y = (plotOffset.top + plotHeight + margin);
                if (labels.length > 1) {
                    y -= options.grid.canvasText.lineBreaks.marginBottom; // move up the labels a bit
                }
                for(var j=0; j < labels.length; j++){
                    if (axis.options.labelAngle != 0){
                        var angledPos = calculateAxisAngledLabels(axis);
                        x = Math.round(plotOffset.left + axis.p2c(tick.v)) + angledPos.oLeft + ctx.fontAscent();
                        y = angledPos.top;
                        ctx.translate(x, y);
                        ctx.rotate(-axis.options.labelAngle*Math.PI/180.);
                        ctx.fillText(label, 0, 0);
                        ctx.rotate(axis.options.labelAngle*Math.PI/180.);
                        ctx.translate(-x, -y);
                    } else {
                        /**
                        * implements an equivalent to the text-align:center CSS option
                        */
                        x = Math.round(plotOffset.left + axis.p2c(tick.v) - ctx.measureText(labels[j]).width/2);
                        /**
                        * where:
                        *   plotOffset.left = area where the Y axis is plotted (left of the actual graph)
                        *   axis.p2c(tick.v) = # of pixels associated with the tick value
                        *   labelWidth/2 = half of the length of the label so it's centered
                        */
                        y += ctx.fontAscent();
                        /**
                        * where:
                        *   ctx.fontAscent() = height of the character
                        */
                        ctx.fillText(labels[j],x,y);
                        y += options.grid.canvasText.lineBreaks.lineSpacing; // for line-spacing
                    }
                }

            });
            
            addLabels(axes.yaxis, function (tick, axis) {
                var label = tick.label;
                var labelWidth = ctx.measureText(label).width;
                var labelHeight = ctx.fontAscent();
                var plotOffsetLeftArea = plotOffset.left - margin;
                var x, y;
                // based on ryleyb labelAngle modifications to flot
                if (axis.options.labelAngle != 0){
                    var angledPos = calculateAxisAngledLabels(axis);
                    x = angledPos.left + ctx.fontAscent();
                    y = Math.round(plotOffset.top + axis.p2c(tick.v)) + angledPos.oTop;
                    ctx.translate(x, y);
                    ctx.rotate(-axis.options.labelAngle*Math.PI/180.);
                    ctx.fillText(label, 0, 0);
                    ctx.rotate(axis.options.labelAngle*Math.PI/180.);
                    ctx.translate(-x, -y);

                } else {
                    /**
                    * implements an equivalent to the text-align:right CSS option
                    */
                    x =(Math.round(labelWidth) < plotOffsetLeftArea)?plotOffsetLeftArea-Math.round(labelWidth):0;
                    x -=(Math.round(labelWidth) > plotOffsetLeftArea)?Math.round(labelWidth)-plotOffsetLeftArea:0;
                    y = Math.round(plotOffset.top + axis.p2c(tick.v) - labelHeight / 2) + ctx.fontAscent();
                    ctx.fillText(label, x, y);
                }
            });
        };

        // copied from ryleyb labelAngle modifications to flot
        function calculateRotatedDimensions(width,height,angle){
            if (!angle)
                return {};
            var rad = angle * Math.PI / 180,
                sin   = Math.sin(rad),
                cos   = Math.cos(rad);

            var x1 = cos * width,
                y1 = sin * width;
            var x2 = -sin * height,
                y2 = cos * height;
            var x3 = cos * width - sin * height,
                y3 = sin * width + cos * height;
            var minX = Math.min(0, x1, x2, x3),
                maxX = Math.max(0, x1, x2, x3),
                minY = Math.min(0, y1, y2, y3),
                maxY = Math.max(0, y1, y2, y3);

            //next figure out the x,y locations of certain points on the rotated
            //rectangle
            //specifically, if our rectangle is defined by (0 ,0),(w,0),(w ,-h ),(-h,0)
            //for negative angles:
            //  -we need to know where (-h',0'), as it is the left-most point
            //  -we need to know where (-h/2',0') is , for center alignment
            //  -and the same for the right side - (w',0') and (w',-h/2')
            var aligned_left = { x: height/2 * sin, y: height/2 * cos};
            var aligned_right = {x: (width*cos + height/2*sin), y: (width*sin - height/2*cos)};//(w',-h/2')
            var topmost,bottommost,leftmost;
            if (angle < 0){
                bottommost = { x: (width*cos + height*sin), y:(width*sin - height*cos)};//(w',-h')
                leftmost = { x: height * sin, y: height * cos};
            } else {
                topmost = { x: x1, y: y1};//(w',0)
                bottommost = { x: height * sin, y: -height*cos};//(0',-h')
            }

            return { width: (maxX-minX), height: (maxY - minY),
                     a_left:aligned_left, a_right:aligned_right,
                     topmost:topmost,bottommost:bottommost,
                     leftmost:leftmost};
        }
        function calculateAxisAngledLabels(axis){
            var angle = axis.options.labelAngle;
            if (angle == undefined || angle == 0)
                return {};
            var box = axis.box;
            var dims = calculateRotatedDimensions(axis.options.origWidth,axis.options.origHeight,angle);
            var align = "left";
            var oLeft=0, oTop=0, top, left;

            if (axis.position == 'bottom'){
                top = box.top + box.padding;
                if (angle < 0) {
                    if (hasCSS3transform)
                        oLeft = -dims.a_left.x;
                    else
                        oLeft = dims.a_left.x;
                } else {
                    align = "right";
                    oLeft = -dims.a_right.x;
                    if (hasCSS3transform)
                        top += dims.topmost.y;
                }
            } else if (axis.position == 'top') {
                top = box.top;
                if (hasCSS3transform && angle > 0)
                    top += box.height - box.padding + dims.bottommost.y;

                if (angle < 0)
                    align = "right";
                if (!hasCSS3transform && angle < 0){
                    oLeft = -dims.width - dims.a_left.x;
                } else {
                    if (angle < 0)
                        oLeft = -dims.a_right.x;
                    else
                        oLeft = -dims.a_left.x;
                }
            } else if (axis.position == 'left') {
                align = "right";
                left = box.left;
                if (angle < 0) {
                    oTop = dims.a_right.y;
                    if (hasCSS3transform)
                        left -= dims.leftmost.x;
                } else {
                    //left += (axis.options.origWidth-dims.width);
                    if (!hasCSS3transform)
                        oTop = -dims.a_left.y;
                    else
                        oTop = dims.a_right.y;
                }
            } else if (axis.position == 'right') {
                align = "left";
                left = box.left + box.padding;
                if (angle < 0) {
                    if (hasCSS3transform)
                        left -= dims.leftmost.x;
                    oTop = -dims.a_left.y;
                } else {
                    if (!hasCSS3transform)
                        oTop = -dims.height + dims.a_left.y;
                    else
                        oTop = -dims.a_left.y;
                }
            }

            return {top: top, left: left, oTop: oTop, oLeft: oLeft, align: align };
        }

        /**
        * This is the modified version of FLOT's insertLegend function.
        * All the N/E/W/S placements are currently supported
        * todo: add support to off-plot placement
        */  
        plot.insertLegendCanvasText = function (ctx) {
            var options = plot.getOptions();
            var series = plot.getData();
            var plotOffset = plot.getPlotOffset();
            var plotHeight = plot.height();
            var plotWidth = plot.width();

            if (!options.legend.show)
                return;

            var lf = options.legend.labelFormatter, s, label, legendWidth, legendHeight;

            legendWidth = 0;
            legendHeight = 0;

            var series_with_legend = $.grep(series, function(s) {
                return !(!s.label || (s.legend && !s.legend.show));
            });
            /**
             * Calculates the width of the legend area
             */
            for (var j = 0; j < series_with_legend.length; ++j) {
                s = series_with_legend[j];
                label = s.label;
                if (lf)
                    label = lf(label, s);
                var labelWidth = ctx.measureText(label).width;
                if (labelWidth > legendWidth) {
                    legendWidth = labelWidth
                }
            }

            /**
             * 22 is the width of the color boxes to the left of the series legend labels
             * 18 is the line-height of those boxes (i.e. series)
             */
            var LEGEND_BOX_WIDTH = 22;
            var LEGEND_BOX_LINE_HEIGHT = 18;
            legendWidth = legendWidth + LEGEND_BOX_WIDTH;
            legendHeight = series_with_legend.length * LEGEND_BOX_LINE_HEIGHT;

            var x, y;
            if (options.legend.container != null) {
                x = $(options.legend.container).offset().left;
                y = $(options.legend.container).offset().top;
            } else {
                var p = options.legend.position,
                        m = options.legend.margin;
                if (m[0] == null)
                    m = [m, m];
                if (p.charAt(0) == "n") {
                    y = Math.round(plotOffset.top + options.grid.borderWidth + m[1]);
                } else if (p.charAt(0) == "s") {
                    y = Math.round(plotOffset.top + options.grid.borderWidth + plotHeight - m[0] - legendHeight);
                }
                if (p.charAt(1) == "e") {
                    x = Math.round(plotOffset.left + options.grid.borderWidth + plotWidth - m[0] - legendWidth);
                } else if (p.charAt(1) == "w") {
                    x = Math.round(plotOffset.left + options.grid.borderWidth + m[0]);
                }

                if (options.legend.backgroundOpacity != 0.0) {
                    var c = options.legend.backgroundColor;
                    if (c == null) {
                        c = options.grid.backgroundColor;
                    }
                    if (c && typeof c == "string") {
                        ctx.globalAlpha = options.legend.backgroundOpacity;
                        ctx.fillStyle = c;
                        ctx.fillRect(x, y, legendWidth, legendHeight);
                        ctx.globalAlpha = 1.0;
                    }
                }
            }

            var posx, posy;
            for (var i = 0; i < series_with_legend.length; ++i) {
                s = series_with_legend[i];
                label = s.label;

                if (lf) {
                    label = lf(label, s);
                }

                posy = y + (i * 18);
                ctx.fillStyle = options.legend.labelBoxBorderColor;
                ctx.fillRect(x, posy, 18, 14);
                ctx.clearRect(x + 1, posy + 1, 16, 12);

                ctx.fillStyle = s.color;
                ctx.fillRect(x + 2, posy + 2, 14, 10);

                posx = x + 22;
                posy = posy + ctx.fontAscent();

                ctx.fillStyle = "black";
                ctx.fillText(label, posx, posy);
            }
        };

        /**
        * Adds hook to enable this plugin's logic shortly after drawing the whole graph
        */  
        plot.hooks.draw.push(enableCanvasText);
    }
    
    $.plot.plugins.push({
        init: init,
        options: options,
        name: 'flot.canvas.text',
        version: '0.1'
    });
})(jQuery);
