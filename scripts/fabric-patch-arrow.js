// Extended fabric line class
fabric.LineArrow = fabric.util.createClass(fabric.Line, {

  type: 'lineArrow',

  initialize: function(element, options) {
    options || (options = {});
    this.callSuper('initialize', element, options);
  },

  toObject: function() {
    return fabric.util.object.extend(this.callSuper('toObject'));
  },

  _render: function(ctx) {
    this.ctx = ctx;
    //this.callSuper('_render', ctx);
    let p = this.calcLinePoints();
    let xDiff = this.x2 - this.x1;
    let yDiff = this.y2 - this.y1;
    let angle = Math.atan2(yDiff, xDiff);
    this.drawArrow(angle, p.x2, p.y2, this.heads[0]);
    ctx.save();
    xDiff = -this.x2 + this.x1;
    yDiff = -this.y2 + this.y1;
    angle = Math.atan2(yDiff, xDiff);
    this.drawArrow(angle, p.x1, p.y1, this.heads[1]);
    this.drawLine(angle, Math.sqrt(xDiff**2 + yDiff**2) );
  },

  // copied from fabric.Line._render
  drawLine: function(angle, length) {
    ctx = this.ctx;
    // Remove 5px from line on each side to make room for arrow
    let halfLength = Math.max(0, 0.5*length - 5);
    ctx.save();
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-halfLength, 0);
    ctx.lineTo( halfLength, 0);
    ctx.lineWidth = this.strokeWidth;
    ctx.strokeStyle = this.stroke || ctx.fillStyle;
    this.stroke && this._renderStroke(ctx);    
    ctx.restore();  
  },
  
  drawArrow: function(angle, xPos, yPos, head) {
    this.ctx.save();
   
    if (head) {
    	this.ctx.translate(xPos, yPos);
    	this.ctx.rotate(angle);
      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(-10, 5);
      this.ctx.lineTo(-10, -5);
      this.ctx.closePath();
    }
    
    this.ctx.fillStyle = this.stroke;
    this.ctx.fill();
    this.ctx.restore();
  }
});



fabric.LineArrow.fromObject = function(object, callback) {
  callback && callback(new fabric.LineArrow([object.x1, object.y1, object.x2, object.y2], object));
};

fabric.LineArrow.async = true;

