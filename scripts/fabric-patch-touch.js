/*
Patch for Fabric.js:
------------------
 Fix allow touch scrolling #5904
 Important, this code above should be before fabric canvas init 
 and "allowTouchScrolling: true" should be added (v.4.2.0):
    canvas = new fabric.Canvas('canvasId', {allowTouchScrolling: true});
 See: https://github.com/fabricjs/fabric.js/pull/5904
*/
(function() {
          var addListener = fabric.util.addListener,    
              removeListener = fabric.util.removeListener,
              addEventOptions = { passive: false };

          fabric.util.object.extend(fabric.Canvas.prototype, /** @lends fabric.Canvas.prototype */ {
            _onTouchStart: function(e) {
              var targetR = this.findTarget(e);
              !this.allowTouchScrolling && e.preventDefault && e.preventDefault();
              targetR && e.preventDefault && e.preventDefault();
              if (this.mainTouchId === null) {
                this.mainTouchId = this.getPointerId(e);
              }
              this.__onMouseDown(e);
              this._resetTransformEventData();
              var canvasElement = this.upperCanvasEl,
              eventTypePrefix = this._getEventPrefix();
              addListener(fabric.document, 'touchend', this._onTouchEnd, addEventOptions);
              addListener(fabric.document, 'touchmove', this._onMouseMove, addEventOptions);
              // Unbind mousedown to prevent double triggers from touch devices
              removeListener(canvasElement, eventTypePrefix + 'down', this._onMouseDown);
            }
          });
        })();
