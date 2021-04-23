/* MIT License

Copyright (c) 2021 jeroenvantilburg

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
// All code runs in this anonymous function
// to avoid cluttering the global variables
(function() {

  /* ========== GLOBAL SECTION =================
       Global variables are defined here
     =========================================== */
  
  // HTML elements
  let video           = document.getElementById('video');
  let canvasVideo     = document.getElementById('canvasVideo');
  let canvasVideoCtx  = canvasVideo.getContext('2d');
  canvasVideoCtx.save();
  
  // Global video parameters
  let currentFrame = 0;
  let t0 = 0;
  let zoomLevel = 1;
  let FPS; // Frame rate
  let pixelsPerMeter;
  let distanceInMeter;
  let originX, originY; // in pixels
  let videoRotation = 0; // in degrees
  let demoLocation = "videos/demo_bounching_ball.mp4";

  // The raw data (all derived data is calculated on the fly)
  let rawData = [];
  let dataIsSaved = true;

  /* ========== RESPONSIVE SECTION =============
       Adjust design to screen size
     =========================================== */
  
  // Hide/show sidebar on small screens
  let maxSideBarWidth = 360; // Width of sidebar (can be smaller on small mobile screens)
  $(".showSideBar").click( () => {     
    let sideBarWidth = Math.min(maxSideBarWidth, window.innerWidth ); 
    $(".sidebar").width( sideBarWidth );
    $(".showSideBar").hide();
    $(".hideSideBar").show();
  });
  $(".hideSideBar").click( () => { 
    $(".sidebar").width(0);
    $(".showSideBar").show();
    $(".hideSideBar").hide();
  });

  // Event listener for resizing the window
  $(window).resize( resizeWindow );
  function resizeWindow() {
        
    // Modify width of sidebar if it becomes too small
    let sideBarWidth = Math.min(maxSideBarWidth, window.innerWidth ); 
    $(".sidebar").width( sideBarWidth );
    $('#positionChart').parent().width( sideBarWidth-10 );
    $('#velocityChart').parent().width( sideBarWidth-10 );
    $('#accelerationChart').parent().width( sideBarWidth-10 );

    if( window.innerWidth > 780 ) { // 780 is the division between small/large screens
      $(".sidebar").width( sideBarWidth );
      $(".showSideBar").hide();
      $(".hideSideBar").hide();      
    } else {
      if( $(".sidebar").width() < 1 ) { $(".hideSideBar").click(); }
      else { $(".showSideBar").click(); }
    }
  }

  // load all code after the document
  $("document").ready( () => {
    $("#videoImport").removeAttr('disabled'); // Videos can now be imported
    resizeWindow(); // Trigger resize for responsive effect
    setFeedback();
  });
  
  // set the feedback tag
  function setFeedback() {
    var name = "smackjvantilburgsmack"; // add salt
    name = name.substr(5,11); // remove salt
    $("feedback").html(name+"@gmail.com");  
  }

  /* ======= DROPDOWN MENU SECTION =============
     Hovering, clicking on dropdown menu
     =========================================== */  

  // Event listeners for the dropdown menu
  function showDropdownMenu() { 
    $(".dropbtn").css("background-color","#aaa");
    $(".dropdown-content").show();}
  function hideDropdownMenu() {
    $(".dropbtn").css("background-color","inherit");
    $(".dropdown-content").hide();
  }
  $(".dropdown").hover( showDropdownMenu, hideDropdownMenu );
  $(".dropdown-content").on("click", hideDropdownMenu );
  $(".dropbtn").on("click touchend", (e) => { 
    // prevent touch event from propagating and showing dropdown via onmouseenter + click method
    if( e.type == "touchend" ) e.preventDefault();    
    if( $(".dropdown-content").is(":visible") ) hideDropdownMenu() ;
    else if( $(".dropdown-content").is(":hidden") ) showDropdownMenu() ;
  } );
  // Close the dropdown menu when user touches anywhere outside the menu
  $(window).on("touchend", (e) => {
    if( $(".dropdown-content").is(":visible") &&
        $(".dropdown").has(e.target).length == 0 ) hideDropdownMenu();
  });

  
  /* ============= MODAL SECTION =================
     Define functions for the modal boxes.
     Shows and hides the modal boxes.
     =========================================== */    

  // Event listener for the different modal boxes
  $("#showMediaInfo").click( evt => { writeVideoInfo(); showModal("mediaInfoModal"); });
  $("#showAbout").click( evt => { showModal("aboutModal"); } );
  $("#showHelp").click( evt => { showModal("helpModal");} );
  $("#showSettings").click( evt => { showModal("settingsModal");} );
  $(".chart").click( function() { showModalChart( this ); showModal("graphModal"); });
  
  // Showing modal box
  function showModal(name) { $("#"+name).toggle(); }

  // When the user clicks on <span> (x), close the current modal
  $(".close").on("click", function() { $(this).parent().parent().toggle(); });
  
  // When the user clicks anywhere outside of the modal, close it
  $(window).on("click", function(event) {
    if( event.target.className === "modal" ) event.target.style.display = "none";
  });

  
  /* ===== INPUT TEXT ELEMENTS SECTION =========
     Define functions for the modal boxes.
     Shows and hides the modal boxes.
     =========================================== */    

  // Remove focus after enter for all input text elements
  let focusedElement;
  function blurOnEnter(e){ 
    if(e.keyCode===13){ 
      e.target.blur();
      focusedElement = null;
    } 
  }
  $("input[type=text]").on("keydown", blurOnEnter );
  $("input[type=number]").on("keydown", blurOnEnter );

  // Put cursor always at last position when clicking on input text element
  $(document).on('focus', 'input[type=text]', function () {    
    //already focused, return so user can now place cursor at specific point in input.    
    if (focusedElement == this) return; 
    focusedElement = this;
    // select all text in any field on focus for easy re-entry. 
    // Delay sightly to allow focus to "stick" before selecting.
    setTimeout(function () {focusedElement.setSelectionRange(9999,9999);}, 0);
  });

  
  /* ========== General functions ====================
      Useful functions to check/convert numbers
     ================================================= */
  
  function toNumber(string){
    return parseFloat( parseFloat( string.replace(',','.') ).toPrecision(6));
  }

  function isNumeric(str) {
    if (typeof str != "string") return false; // we only process strings!  
    let string = str.replace(',','.')
    return !isNaN(string) && // use type coercion to parse the _entirety_ of the string
           !isNaN(parseFloat(string)) // ...and ensure strings of whitespace fail
  }
 
  function iOS() {
    return [ 'iPad Simulator', 'iPhone Simulator', 'iPod Simulator',
            'iPad', 'iPhone', 'iPod' ].includes(navigator.platform)
      || (navigator.userAgent.includes("Mac") && "ontouchend" in document);  // iPad on iOS 13 detection
  }

  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /* ========= Load the MediaInfo library ============
       Dynamically choose between Wasm and 
       asm.js libraries.
     ================================================= */

  let MediaInfoJs = document.createElement('script');
  if ('WebAssembly' in window && typeof Promise  !== 'undefined' && !iOS() ) {
    // Only browsers that support Wasm, Promise. iOS gives maximum stack size exceeded error
    MediaInfoJs.src = "scripts/MediaInfoWasm.js";
  } else {
    MediaInfoJs.src = "scripts/MediaInfo.js";
  }
  document.body.appendChild(MediaInfoJs);

  // Continue initialization
  let MediaInfoModule;
  MediaInfoJs.onload = function () {
    MediaInfoModule = MediaInfoLib({
      'postRun': function() {
        if (typeof Promise !== 'undefined' && MediaInfoModule instanceof Promise) {
          MediaInfoModule.then(function(module) {          
            MediaInfoModule = module;
          });
        }
      }
    });
  }
  
  /* ========== GRAPHICS SECTION ==============
       Draw the calibration controls with 
       Fabric.js library
     =========================================== */

  // Initialize canvas using Fabric.js
  var canvas = this.__canvas = new fabric.Canvas('canvasOutput', 
                                                 { selection: false, 
                                                   uniformScaling: false,
                                                   centeredKey: null,
                                                   altActionKey: null,
                                                   allowTouchScrolling: true,
                                                   preserveObjectStacking: true });
  fabric.Object.prototype.originX = fabric.Object.prototype.originY = 'center';
  fabric.Object.lockSkewingX = fabric.Object.lockSkewingY = true;
  let shadow = new fabric.Shadow({color: 'black', blur: 1 });  
  
  // Define marker style
  let markerPoint = new fabric.Circle({ radius: 3, stroke: 'rgba(220,0,0)', strokeWidth: 1, 
                                        fill: 'rgba(0,0,0,0)', shadow: shadow,
                                        selectable: false, evented: false });
  function highlightMarker( markerP ) { markerP.set({stroke: 'red', strokeWidth: 2}); }
  function unHighlightMarker( markerP ) { markerP.set({stroke: 'rgba(220,0,0)', strokeWidth: 1}); }
  
  // Define track box for automatic analysis
  let trackBox = new fabric.Rect({left: -100, top: -100, height: 150, width: 150, 
                                     fill: 'rgba(0,0,0,0)', stroke: 'red', strokeWidth: 2,
                                     lockRotation: true, strokeUniform: true, noScaleCache: false,
                                     cornerSize: 8, cornerStyle: 'circle', 
                                     cornerColor: 'rgba(35,118,200)', shadow: shadow,
                                     hasBorders: false, selectable: true, evented: true, 
                                     lockScalingFlip: true });  
  trackBox.setControlsVisibility({ mtr: false }); // Hide rotating point
  
  // Define the region of interest (ROI) as an orange box
  let roiBox = fabric.util.object.clone( trackBox ) ;
  let roiScaleX = 4, roiScaleY = 4;
  let roiOffsetX = 0, roiOffsetY = 0;
  roiBox.set({stroke: 'orange', scaleX: roiScaleX, scaleY: roiScaleY });
  
  // When moving the trackBox update the position/scale of the ROI
  trackBox.on("moving", () => {
    roiBox.set({ left: roiOffsetX*zoomLevel + trackBox.left, 
                  top: roiOffsetY*zoomLevel + trackBox.top });
    roiBox.setCoords();
  });

  // When scaling the trackBox update the scale of the ROI
  trackBox.on("scaling", (e) => {
    roiOffsetX *= roiScaleX * trackBox.scaleX / roiBox.scaleX;
    roiOffsetY *= roiScaleY * trackBox.scaleY / roiBox.scaleY; 

    // Update trackBox.left/top with new scale
    let orig = e.transform.original; // Get the original positions 
    let trackLeft = trackBox.left;
    if( e.transform.originX === "left" ){ // Scaling from the right corners
      trackLeft = orig.left + 0.5*trackBox.width*(trackBox.scaleX-orig.scaleX);
    } else {                              // Scaling from the right corners
      trackLeft = orig.left + 0.5*trackBox.width*(orig.scaleX-trackBox.scaleX);      
    }
    let trackTop = trackBox.top;
    if( e.transform.originY === "top" ){ // Scaling from the bottom corners
      trackTop = orig.top + 0.5*trackBox.height*(trackBox.scaleY-orig.scaleY);
    } else {                              // Scaling from the top corners
      trackTop = orig.top + 0.5*trackBox.height*(orig.scaleY-trackBox.scaleY);      
    }

    roiBox.set({ left: roiOffsetX*zoomLevel + trackLeft, 
                  top: roiOffsetY*zoomLevel + trackTop, 
                 scaleX: roiScaleX * trackBox.scaleX, 
                 scaleY: roiScaleY * trackBox.scaleY });
    roiBox.setCoords();
  });
  
  // When moving the ROI, the trackBox should stay within the ROI
  roiBox.on("moving", () => {
    roiBox.setCoords();
    trackBox.setCoords();
    let tolerance = 3;
    if( roiBox.oCoords.tl.x - trackBox.oCoords.tl.x > -tolerance ) {
      roiBox.set({left: trackBox.oCoords.tl.x + 0.5*roiBox.width*roiBox.scaleX - tolerance });
    }
    else if( roiBox.oCoords.br.x - trackBox.oCoords.br.x < tolerance ) {
      roiBox.set({left: trackBox.oCoords.tr.x - 0.5*roiBox.width*roiBox.scaleX + tolerance });
    }
    if( roiBox.oCoords.tl.y - trackBox.oCoords.tl.y > -tolerance ) {
      roiBox.set({top: trackBox.oCoords.tl.y + 0.5*roiBox.height*roiBox.scaleY - tolerance });
    }
    else if( roiBox.oCoords.br.y - trackBox.oCoords.br.y < tolerance ) {
      roiBox.set({top: trackBox.oCoords.br.y - 0.5*roiBox.height*roiBox.scaleY + tolerance });
    }

    // Update the offset of the ROI with respect to the trackBox
    roiOffsetX = (roiBox.left - trackBox.left)/zoomLevel;
    roiOffsetY = (roiBox.top  - trackBox.top)/zoomLevel;      
  });

  // When scaling the ROI, the trackBox should stay within the ROI
  roiBox.on("scaling", (e) => {
    let orig = e.transform.original; // Get the original positions 
    let trackRect = trackBox.getBoundingRect(); // Get the trackBox boundaries
    let tolerance = 3;
    if( e.transform.originX === "left" ){ // Scaling from the right corners
      let roiX1 = orig.left - 0.5*roiBox.width*orig.scaleX;
      let roiX2 = roiX1 + roiBox.width*roiBox.scaleX;
      let trackX2 = trackRect.left + trackRect.width;
      if( roiX2 - trackX2 <= tolerance ) {
        roiBox.set({ scaleX: (trackX2 - roiX1 + tolerance  ) / roiBox.width });
      }
    } else {                              // Scaling from the left corners
      let roiX2 = orig.left + 0.5*roiBox.width*orig.scaleX;      
      let roiX1 = roiX2 - roiBox.width*roiBox.scaleX;
      let trackX1 = trackRect.left;
      if( roiX1 - trackX1 >= -tolerance ) {
        roiBox.set({ scaleX: (roiX2 - trackX1 + tolerance  ) / roiBox.width });
      }
    }
    if( e.transform.originY === "top" ){ // Scaling from the bottom corners
      let roiY1 = orig.top  - 0.5*roiBox.height*orig.scaleY;
      let roiY2 = roiY1 + roiBox.height*roiBox.scaleY;
      let trackY2 = trackRect.top + trackRect.height;
      if( roiY2 - trackY2 <= tolerance ) {
        roiBox.set({ scaleY: (trackY2 - roiY1 + tolerance ) / roiBox.height });
      }
    } else {                             // Scaling from the top corners
      let roiY2 = orig.top + 0.5*roiBox.height*orig.scaleY;
      let roiY1 = roiY2 - roiBox.height*roiBox.scaleY;
      let trackY1 = trackRect.top;
      if( roiY1 - trackY1 >= -tolerance ) {
        roiBox.set({ scaleY: (roiY2 - trackY1 + tolerance ) / roiBox.height });
      }
    }

    // Update the scale and the offset of the ROI wrt the trackBox
    roiScaleX = roiBox.scaleX / trackBox.scaleX; 
    roiScaleY = roiBox.scaleY / trackBox.scaleY;
    roiOffsetX = (roiBox.left - trackBox.left)/zoomLevel;  
    roiOffsetY = (roiBox.top  - trackBox.top )/zoomLevel;
  });
  
  
  // Define axes for canvas with dummy coordinates
  let xAxis = new fabric.Line( [0,0,100,0], {strokeWidth: 3, stroke: 'royalblue',
                                             hasControls: false, hasBorders: false, 
                                             lockMovementX: true, padding: 10, shadow: shadow });    
  let yAxis = new fabric.Line( [0,0,0,100], {strokeWidth: 3, stroke: 'royalblue',
                                             hasControls: false, hasBorders: false, 
                                             lockMovementY: true, padding: 10, shadow: shadow });    
  let axesOrigin = new fabric.Circle({ radius: 5, padding: 10, fill: 'blue', shadow: shadow,
                                       hasControls: false, hasBorders: false });
  
  // Event listeners for axes
  axesOrigin.on("moving", () => {
    xAxis.set({y1: axesOrigin.top, y2: axesOrigin.top} );
    yAxis.set({x1: axesOrigin.left, x2: axesOrigin.left} );  
    xAxis.setCoords();
    yAxis.setCoords();
  });
  axesOrigin.on("moved", () => {
    $("#originXInput").val( axesOrigin.left / zoomLevel );
    $("#originYInput").val( axesOrigin.top / zoomLevel );
    $("#originXInput").change();
    $("#originYInput").change();
  });
  xAxis.on("moving", () => {
    axesOrigin.set({top: xAxis.top});
  });
  xAxis.on("moved", () => {
    $("#originYInput").val( xAxis.top / zoomLevel );
    $("#originYInput").change();
  });
  yAxis.on("moving", () => {
    axesOrigin.set({left: yAxis.left});
  });
  yAxis.on("moved", () => {
    $("#originXInput").val( yAxis.left / zoomLevel );
    $("#originXInput").change();
  });

  // Define ruler (line + 2 circles + box) for canvas
  let scaleLine = new fabric.LineArrow( [100,10,100,110], {strokeWidth: 3, stroke: 'limegreen',
                                                  hasControls: false, hasBorders: false, 
                                                  padding: 10, shadow: shadow, heads: [1,1] });    
  let scaleCircle1 = new fabric.Circle({ left:100, top: 10, 
                                         radius: 5, stroke: 'green', strokeWidth: 1,
                                         hasControls: false, hasBorders: false, padding: 10,
                                         fill: 'rgba(0,0,0,0)', shadow: shadow, });
  let scaleCircle2 = new fabric.Circle({ left:100, top: 110,
                                         radius: 5, stroke: 'green', strokeWidth: 1,
                                         hasControls: false, hasBorders: false, padding: 10,
                                         fill: 'rgba(0,0,0,0)', shadow: shadow, });
  let distHeight = parseFloat($("#distanceInput").css("height").slice(0,-2));
  let scaleRect = new fabric.Rect({left: 0, top: 0, height: distHeight, width: 70, 
                                   strokeWidth: 1, stroke: 'green', fill: 'limegreen' });
  let scaleTxt = new fabric.Text('m', {left: 25, top: 0,
                                   fontSize: 16, fontFamily: "Arial" });
  let scaleBox = new fabric.Group( [ scaleRect, scaleTxt], 
                                   {left: 110, top: 50, selectable: false, evented: false}  );
  
  // Set/update the position of the input box
  function setScaleBox() {    
    let length = Math.sqrt((scaleLine.x1-scaleLine.x2)**2 + (scaleLine.y1-scaleLine.y2)**2 );
    let xPos = scaleLine.left + (0.5*scaleBox.width+10)*(scaleLine.y2-scaleLine.y1)/length;
    let yPos = scaleLine.top + (0.5*scaleBox.height+10)*(scaleLine.x1-scaleLine.x2)/length;
    scaleBox.set({left: xPos, top: yPos });
    scaleBox.setCoords();
    $("#distanceInput").css({ left: xPos + 2 - 0.5*scaleBox.width, top: yPos - 0.5*distHeight });
  }
  
  // Event listeners for ruler
  scaleCircle1.on("moving", () => {
    scaleLine.set({x1: scaleCircle1.left, y1: scaleCircle1.top} );
    scaleLine.setCoords();
    setScaleBox();
  });
  scaleCircle1.on("moved", () => {
    setScale();
  });
  scaleCircle2.on("moving", () => {
    scaleLine.set({x2: scaleCircle2.left, y2: scaleCircle2.top} );
    scaleLine.setCoords();
    setScaleBox();
  });
  scaleCircle2.on("moved", () => {
    setScale();
  });
  scaleLine.on("moving", () => {
    let localPoints = scaleLine.calcLinePoints();
    scaleLine.set({x1: localPoints.x1+scaleLine.left, y1: localPoints.y1+scaleLine.top,
                   x2: localPoints.x2+scaleLine.left, y2: localPoints.y2+scaleLine.top});
    scaleCircle1.set({left: scaleLine.x1, top: scaleLine.y1});
    scaleCircle2.set({left: scaleLine.x2, top: scaleLine.y2});
    setScaleBox();
  });
  scaleLine.on("moved", () => {
    scaleLine.setCoords();
    scaleCircle1.setCoords();
    scaleCircle2.setCoords();
  });
    
  /* ========== USER SETTINGS ======================
     These settings can be changed in settings menu
     ================================================= */

  let automaticAnalysis = false;
  $('#automaticAnalysis').prop('checked',automaticAnalysis);
  $('#automaticAnalysis').on('change', function(e) {
    automaticAnalysis = $('#automaticAnalysis').is(':checked');
    if( automaticAnalysis ) {
      canvas.add( trackBox );
      canvas.sendToBack( trackBox )
      if( showROI ) {
        canvas.add( roiBox );
        canvas.sendToBack( roiBox );
      }
    } else {
      canvas.remove( trackBox );      
      if( showROI ) canvas.remove( roiBox );
    }   
  });  

  $("#orientationInput").val( "0" );
  $("#orientationInput").change( function() { 
    rotateContext();
    gotoFrame(currentFrame);
  });
  
  let getMediaInfo = true;
  $("#getMediaInfo").prop('checked', getMediaInfo);
  $("#getMediaInfo").change( function() { 
     getMediaInfo = $('#getMediaInfo').is(':checked');
  });
  
  let drawAllPoints = true;
  $('#drawAllPoints').prop('checked',drawAllPoints);
  $('#drawAllPoints').on('change', function(e) {
    drawAllPoints = $('#drawAllPoints').is(':checked');
    rawData.forEach(function (item) {
      if( drawAllPoints ) {
        canvas.add( item.marker );
      } else if ( item.t !== currentFrame ) {
        canvas.remove( item.marker );
      }
    });
  });

  let framesToSkip = 1;
  $("#framesToSkip").val( framesToSkip );
  $("#framesToSkip").change( function() {
    if( isNumeric(this.value) ) {
      framesToSkip = Math.round( toNumber(this.value) );
    } else {
      this.value = framesToSkip || "";      
    }
  });
  
  let adaptive = false;
  $('#adaptive').prop('checked', adaptive);
  $('#adaptive').on('change', function(e) {
    adaptive = $('#adaptive').is(':checked');
  });
  
  let templateMatchMode = "TM_CCOEFF_NORMED";
  $("#templateMatchMode").val( templateMatchMode );
  $("#templateMatchMode").change( function() { 
    templateMatchMode = this.value ;
  });
  
  let imageConvMode = "";
  $("#imageConvMode").val( imageConvMode );
  $("#imageConvMode").change( function() { 
    imageConvMode = this.value ;
  });
 
  let useROI = true;
  $('#useROI').prop('checked', useROI);
  $('#useROI').on('change', function(e) {
    useROI = $('#useROI').is(':checked');
    // TODO: disable ROI scale and showROI
    if( automaticAnalysis && showROI ) {
      if( useROI ) {
        canvas.add( roiBox );
        canvas.sendToBack( roiBox );
      } else canvas.remove( roiBox );      
    }
  });

  $("#roiScale").val( roiScaleX );
  $("#roiScale").change( function() { 
    roiScaleX = roiScaleY = this.value ;    
    roiOffsetX = roiOffsetY = 0; // always center around trackBox after update
    roiBox.set({ left: trackBox.left, top: trackBox.top, 
                 scaleX: roiScaleX * trackBox.scaleX, 
                 scaleY: roiScaleY * trackBox.scaleY });
    roiBox.setCoords();
    canvas.requestRenderAll();
  });
  
  let showROI = false;
  $('#showROI').prop('checked', showROI);
  $('#showROI').on('change', function(e) {
    showROI = $('#showROI').is(':checked');
    if( automaticAnalysis && useROI ) {
      if( showROI ) {
        canvas.add( roiBox );
        canvas.sendToBack(roiBox)
      } else canvas.remove( roiBox );      
    }
  });

  let integrationTime = 2;
  $("#integrationTimeInput").val( integrationTime );
  $("#integrationTimeInput").change( function() {
    if( isNumeric(this.value) && toNumber(this.value) > 0.5) {
      integrationTime = Math.round( toNumber(this.value) );
      updatePlots(); 
    }
    this.value = integrationTime || "";
  });

  let showVelocity = ($('#velocityChart').css('display') != 'none' );
  $('#showVelocity').prop('checked',showVelocity);
  $('#showVelocity').on('change', function(e) {
    showVelocity = $('#showVelocity').is(':checked');
    $('#velocityChart').toggle();
  });
  
  let showAcceleration = ($('#accelerationChart').css('display') != 'none' );
  $('#showAcceleration').prop('checked',showAcceleration);
  $('#showAcceleration').on('change', function(e) {
    showAcceleration = $('#showAcceleration').is(':checked');
    $('#accelerationChart').toggle();
  });
  
  let decimalSeparator = getDecimalSeparator();
  $("#decimalSeparatorInput").val( decimalSeparator );
  $("decimalSep").html( decimalSeparator );
  $("#decimalSeparatorInput").change( function() { 
    decimalSeparator = this.value ;
    $("decimalSep").html( decimalSeparator );
  });
  
  let delimiter = ",";
  $("#delimiterInput").val( delimiter );
  $("delimiter").html( delimiter );
  $("#delimiterInput").change( function() { 
    delimiter = this.value ; 
    $("delimiter").html( delimiter === "tab" ? "&nbsp;&nbsp;&nbsp;&nbsp;" : delimiter );  
  });

  let avoidEmptyCells = false;
  $('#avoidEmptyCells').on('change', function(e) {
    avoidEmptyCells = $('#avoidEmptyCells').is(':checked');
  });

  $('#advanced').on('change', function(e) {
    $('.advanced').toggle();
  });
  
  $('#reload').on('click', function() {
    location.reload();
  });
  // END USER SETTINGS
  
  
  /* ========== DELETE DATA SECTION ==================
     Delete all data and update plots and buttons.
     Check for unsaved changes when closing window.
     ================================================= */

  function dataCanBeRemoved() {
    return (rawData.length == 0 || dataIsSaved ||
           confirm("This will clear your current data. Are you sure?") );
  }

  $("#deleteData").click( () => { 
    if( dataCanBeRemoved() ) { deleteRawData(); }
  });
  
  function deleteRawData() {
    // Remove the marker from the canvas
    rawData.forEach(function (item) {
      canvas.remove( item.marker );
    });
      
    // Clear the raw data
    rawData = [];
    
    // Disable buttons
    $("#csvExport").attr('disabled', '');
    $("#deleteData").attr('disabled', '');

    // Update plots
    updatePlots();
  }
  
  // Warn user on reload or closing window when there is unsaved data
  $(window).on('beforeunload', function() {
    if( rawData.length == 0 || dataIsSaved ) return undefined;
    return "You have unsaved changes.";
  });
  
  
  /* ============= CSV SECTION =================
       Import and export a csv file
     =========================================== */  
  
  function getDecimalSeparator() {
    // Get the locale for an estimate of the decimal separator
    let locale;
    if (navigator.languages && navigator.languages.length) {
      locale = navigator.languages[0];
    } else {
      locale = navigator.userLanguage || navigator.language || navigator.browserLanguage || 'en';
    }
    console.log("Locale: " + locale);

    const numberWithDecimalSeparator = 1.1;
    return numberWithDecimalSeparator.toLocaleString(locale).substring(1, 2);
  }
  
  function toCSV(number, precision = 6) { // precision=6 is maximum to be recognised as number
    // Store numbers to 6 digits precision
    return number.toPrecision(precision).toString().replace('.',decimalSeparator);
  }

  // Text strings for the colums in the CSV file
  let timeStr    = "time [s]";
  let posXStr    = "x position [m]";
  let posYStr    = "y position [m]";
  let velXStr    = "x velocity [m/s]";
  let velYStr    = "y velocity [m/s]";
  let accXStr    = "x acceleration [m/s²]";
  let accYStr    = "y acceleration [m/s²]";
  let fpsStr     = "Frame rate [Hz]";
  let origXStr   = "x origin [px]";
  let origYStr   = "y origin [px]";
  let scaleStr   = "Scale [px/m]";
  let scaleX1Str = "Scale Point1 x [px]";
  let scaleY1Str = "Scale Point1 y [px]";
  let scaleX2Str = "Scale Point2 x [px]";
  let scaleY2Str = "Scale Point2 y [px]";
  let boxXStr    = "Track Box x [px]";
  let boxYStr    = "Track Box y [px]";
  let boxWStr    = "Track Box width [px]";
  let boxHStr    = "Track Box height [px]";
  
  // Export the data to CSV file after clicking on menu item
  $("#csvExport").click( () => {
    
    // Check if there is data to be written
    if( rawData.length === 0 ) return;
    
    // First line of CSV file contains headers and meta data
    let csvData = [];
    csvData.push({[timeStr]: "", [posXStr]: "", [posYStr]: "", 
                  [velXStr]: "", [velYStr]: "", [accXStr]: "", [accYStr]: "",
                  [fpsStr]: toCSV(FPS), 
                  [origXStr]: toCSV(originX), 
                  [origYStr]: toCSV(originY), 
                  [scaleStr]: toCSV(pixelsPerMeter),
                  [scaleX1Str]: toCSV( scaleCircle1.left/zoomLevel ), 
                  [scaleY1Str]: toCSV( scaleCircle1.top/zoomLevel ),
                  [scaleX2Str]: toCSV( scaleCircle2.left/zoomLevel ), 
                  [scaleY2Str]: toCSV( scaleCircle2.top/zoomLevel ),
                  [boxXStr]: toCSV( trackBox.left/zoomLevel ), 
                  [boxYStr]: toCSV( trackBox.top/zoomLevel ),
                  [boxWStr]: toCSV( trackBox.width*trackBox.scaleX/zoomLevel ), 
                  [boxHStr]: toCSV( trackBox.height*trackBox.scaleY/zoomLevel )
                 } );

    // Remove velocity and/or acceleration depending on user setting
    if( showVelocity == false ) {
      delete csvData[0][velXStr];
      delete csvData[0][velYStr];      
    }
    if( showAcceleration == false ) {
      delete csvData[0][accXStr];
      delete csvData[0][accYStr];      
    }

    // Fill list with velocities and times
    let velocities = [];
    rawData.forEach(function (item, index) {
      if( index > integrationTime-1 ) {
        let velocity = getVelocity(index - integrationTime, index);
        let frame = (item.t + rawData[index-integrationTime].t)/2;
        velocities.push({frame: frame, t: velocity.t, x: velocity.x, y: velocity.y});
      }
    });
    
    // Fill list with acceleration and times
    let accelerations = [];
    velocities.forEach(function (item, index) {
      if( index > integrationTime-1 ) {
        let prevItem = velocities[index - integrationTime];
        let frame = 0.5*(item.frame + prevItem.frame);
        let meanT = 0.5*(item.t + prevItem.t);
        let dt = item.t - prevItem.t;
        let accelX = (item.x - prevItem.x) / dt;
        let accelY = (item.y - prevItem.y) / dt;
        accelerations.push({frame: frame, t: meanT, x: accelX, y: accelY});
      }
    });
    
    // Frame tolerance decides when velocities are grouped with position entries in one row
    let frameTolerance = avoidEmptyCells ? 0.51 : 0.01;
    
    // Create temporary data with positions and velocities (time ordered)
    let tempData = [];
    let vIndex = 0;
    rawData.forEach(function (item, index) {
      let thisFrame = item.t;
      let time = getTime( thisFrame );
      let pos = getXYposition( item );

      // add all velocities before this item
      while( vIndex < velocities.length && 
            velocities[vIndex].frame < thisFrame - frameTolerance ) {
        // add only the velocity
        tempData.push({ frame    : velocities[vIndex].frame,
                        [timeStr]: toCSV( velocities[vIndex].t ), 
                        [velXStr]: toCSV( velocities[vIndex].x ), 
                        [velYStr]: toCSV( velocities[vIndex].y )}  );
        ++vIndex;
      }
      
      // Add the position data
      let n = tempData.push({ frame    : thisFrame,
                              [timeStr]: toCSV(time), 
                              [posXStr]: toCSV(pos.x), 
                              [posYStr]: toCSV(pos.y)}  );        

      // if velocity has same frame number merge it with this entry
      if( vIndex < velocities.length && velocities[vIndex].frame - thisFrame < frameTolerance ) { 
        // combine items
        tempData[n-1][velXStr] = toCSV(velocities[vIndex].x);
        tempData[n-1][velYStr] = toCSV(velocities[vIndex].y);
        ++vIndex;
      }
    });
    
    // Loop over temporary data and add acceleration data
    let aIndex = 0;
    tempData.forEach(function (item, index) {
      let thisFrame = item.frame;
      // add all accelerations before this item
      while( aIndex < accelerations.length && 
             accelerations[aIndex].frame < thisFrame - frameTolerance ) {
        csvData.push({[timeStr]: toCSV( accelerations[aIndex].t ), 
                      [accXStr]: toCSV( accelerations[aIndex].x ), 
                      [accYStr]: toCSV( accelerations[aIndex].y )}  );
        ++aIndex;
      }
      // Copy the temporary data to csvData
      delete item.frame;
      let n = csvData.push( item );        

      // if acceleration has same frame number merge it with this entry
      if( aIndex < accelerations.length && accelerations[aIndex].frame - thisFrame < frameTolerance ) { 
        // combine items
        csvData[n-1][accXStr] = toCSV(accelerations[aIndex].x);
        csvData[n-1][accYStr] = toCSV(accelerations[aIndex].y);
        ++aIndex;
      }       
    });
    
    // Convert the csvData to a csv-formatted string
    let csv = Papa.unparse( csvData, {quotes : true, 
                                      delimiter : delimiter === "tab" ? "\t" : delimiter } );
    //console.log(csv);
    
    // Create a download file based on the video name
    let videoFile = $('#videoInput').prop('files')[0];
    let videoName = (typeof videoFile === "undefined" ) ? "data" : videoFile.name;
    let filename = prompt("Save as...", videoName.substr(0, videoName.lastIndexOf('.'))+".csv");
    if (filename != null && filename != "") {
      download( filename, csv);
    }
    
    // Set the "data is saved" flag to true
    dataIsSaved = true;
  });

  // Create an invisible download element
  function download(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }
  
  // When cvsImport is clicked (dummy button) ask if data can be removed and trigger csvInput  
  $("#csvImport").click( () => {
    if( dataCanBeRemoved() ) {      
      // Progagate to hidden DOM element
      hideDropdownMenu();
      $("#csvInput").click();
    }
  });
  
  // Importing a CSV file into Motion Ticker
  $("#csvInput").change( function() {
    // Get the file
    let file = this.files[0];    
    Papa.parse(file, {
      header: true,
      complete: function(results) {
        
        // check header integrity
        if( results.data.length > 0 &&
            isNumeric( results.data[0][fpsStr]   ) &&
            isNumeric( results.data[0][origXStr] ) && isNumeric( results.data[0][origYStr] ) &&
            isNumeric( results.data[0][scaleStr] ) 
          ) {

          deleteRawData(); // Clear old data

          // Shortcut for the first line which contains the meta data
          let meta = results.data[0];

          // Update the ruler
          if( isNumeric( meta[scaleX1Str] ) && isNumeric( meta[scaleY1Str] ) &&
              isNumeric( meta[scaleX2Str] ) && isNumeric( meta[scaleY2Str] ) ) {
            updateRuler( toNumber( meta[scaleX1Str] ), toNumber( meta[scaleY1Str] ),
                         toNumber( meta[scaleX2Str] ), toNumber( meta[scaleY2Str] ) );
          }

          // Update the header info
          updateFPS( toNumber( meta[fpsStr] ) );
          updateOrigin( toNumber( meta[origXStr] ), toNumber( meta[origYStr] ) );
          updateScale( toNumber( meta[scaleStr] ) );
          
          // Update the track box
          if( isNumeric( meta[boxXStr] ) && isNumeric( meta[boxYStr] ) &&
              isNumeric( meta[boxWStr] ) && isNumeric( meta[boxHStr] ) ) {
            trackBox.set({ left: toNumber( meta[boxXStr] )*zoomLevel, 
                               top: toNumber( meta[boxYStr] )*zoomLevel,
                             width: toNumber( meta[boxWStr] )*zoomLevel/trackBox.scaleX,
                             height:toNumber( meta[boxHStr] )*zoomLevel/trackBox.scaleY });
          }

          // Add raw data
          for(let i=1; i<results.data.length; ++i ){
            let item = results.data[i];

            // check not empty
            if( isNumeric(item[timeStr]) && isNumeric(item[posXStr]) && isNumeric(item[posYStr]) ) {
              let frame = Math.floor( toNumber(item[timeStr])*FPS );
              let xPos  = originX + toNumber(item[posXStr])*pixelsPerMeter;
              let yPos  = originY - toNumber(item[posYStr])*pixelsPerMeter;
              let rawDataPoint = {t: frame, x: xPos, y: yPos };  

              addRawData( rawDataPoint );
            }
          }
           
          // Update plots
          updatePlots();
        } else {
          // Header is not valid: send an alert
          alert("Error loading csv file: header information not complete");
        }
      }
    });
    
  });
  
  /* ============= DEMO SECTION =================
       Loading the demo video with its settings
     =========================================== */  
  
  $("#demo").click( () => {
    if( dataCanBeRemoved() ) {
      clearDataAndVideo();

      // Get the demo-file. Triggers loadedmetadata and loadeddata
      video.src = demoLocation;
      
      // Set automatic analysis if openCV is ready. Otherwise it is set when openCV.load is triggered
      if( openCVReady ) {
        $('#automaticAnalysis').prop('checked', true);
        $('#automaticAnalysis').change();
      }
    }
  });

  /* ============= VIDEO SECTION =================
     Importing a video file
     =========================================== */  
  
  // Trigger click on videoInput when user clicks on menu item
  $("#videoImport").click( () => {
    if( dataCanBeRemoved() ) {       
      // Reset the file input such that it triggers any change
      $("#videoInput").val('');

      // Progagate to (hidden) DOM element
      $("#videoInput").click();
    }
  });
  
  // Clear old data and video stuff
  function clearDataAndVideo() {
    // Remove old video source
    video.removeAttribute('src'); // empty source
    video.load();

    // Clear raw data and meta data
    deleteRawData();
    FPS = undefined;
    updateFPS();
    pixelsPerMeter = undefined;
    updateScale();
    distanceInMeter = undefined;
    $("#distanceInput").val("");
    originX = originY = undefined;
    updateOrigin();
    canvas.clear();
    
    canvasVideoCtx.restore(); // Go back to original state
    $("#orientationInput").val("0"); 
    videoRotation = 0;
    
    // Disable video control and reset video parameters when selecting new video
    disableAnalysis();
    disableVideoControl();
    $('#frameNumber').html( "0 / 0" );
    $("#slider").attr("max", 0 );
  }
  
  // Add event listener for when file is selected
  $("#videoInput").change( function() {

    // Remove old data and video elements
    clearDataAndVideo();

    // Get the file
    let URL = window.URL || window.webkitURL;
    let file = this.files[0];
    video.src = URL.createObjectURL(file);
  });
  
  // video playback failed - show a message saying why
  video.addEventListener('error', (e) => {
    switch (e.target.error.code) {
      case e.target.error.MEDIA_ERR_ABORTED:
        alert('You aborted the video playback.');
        break;
      case e.target.error.MEDIA_ERR_NETWORK:
        alert('A network error caused the video download to fail part-way.');
        break;
      case e.target.error.MEDIA_ERR_DECODE:
        alert('The video playback was aborted due to a corruption problem or because the video used features your browser did not support.');
        break;
      case e.target.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
        alert('The video could not be loaded, either because the server or network failed or because the format is not supported.');
        break;
      default:
        alert('An unknown error occurred.');
        break;
    }
    // Remove old data and video elements
    clearDataAndVideo();
  });
  
  
  // Prepare canvas size, calibration controls and set frame rate when meta data is available
  video.addEventListener('loadedmetadata', () => {

    // Pause the video (needed because of autoplay)
    video.pause();
    
    // Set the dimensions of the video and prepare the canvas
    setVideoZoom(1.0);
    
    // Prepare analysis for the demo video
    if( (video.src).endsWith( demoLocation ) ) {

      // Set the origin, ruler and track box for the DEMO VIDEO (hardcoded)
      updateOrigin(32.85, 374.6 );
      updateRuler( 54.2, 184.7, 51.8, 370.5);
      updateScale( 185.8155 );
      trackBox.set({left: 42.35, top: 24, 
                       width: 16.3/trackBox.scaleX, 
                       height: 28.0/trackBox.scaleY });
      trackBox.setCoords();
      roiBox.set({left: trackBox.left, top: trackBox.top, 
                  width: trackBox.width, height: trackBox.height });
      roiBox.setCoords();

      // Put the graphics back
      showCalibrationControls();

      // Get the frame rate
      updateFPS( "29.97" );
      
      $('#statusMsg').html('Click on "Start analysis" ' );
      return;
    }
    
    // Set initial position for the origin (relative to video dimensions)
    updateOrigin(0.1*video.videoWidth, 0.9*video.videoHeight);

    // Set initial position for the scale/ruler (relative to video dimensions)
    updateRuler( 0.2*video.videoWidth, 0.3*video.videoHeight,
                 0.2*video.videoWidth, 0.7*video.videoHeight );

    // Set initial position for the trackBox (relative to video dimensions)
    trackBox.set({left: 0.5*video.videoWidth, top: 0.3*video.videoHeight,
                     width: 0.1*video.videoWidth/trackBox.scaleX, 
                     height: 0.1*video.videoHeight/trackBox.scaleY });
    trackBox.setCoords();
    
    roiBox.set({left: 0.5*video.videoWidth, top: 0.3*video.videoHeight,
                width: 0.1*video.videoWidth/trackBox.scaleX, 
                height: 0.1*video.videoHeight/trackBox.scaleY });
    roiBox.setCoords();

    // Highlight fields that still need to be filled
    $("#scaleInput").css( "background", "pink");
    $("#fpsInput").css("background", "pink");
    
    // Put the graphics back
    showCalibrationControls();
    if( automaticAnalysis ) {
      canvas.add( trackBox );
      canvas.sendToBack( trackBox );
      if( useROI && showROI) {
        canvas.add( roiBox );
        canvas.sendToBack( roiBox );
      }
    }

    // Get the frame rate
    if( getMediaInfo ) getFPS();
    else $('#statusMsg').html("Set the frame rate manually");
  });
  
  // Show the video when it has been loaded
  video.addEventListener('loadeddata', () => {    
    let firstFrame = 0;
    if( (video.src).endsWith( demoLocation ) ) firstFrame = 5; // exception for the demo
    gotoFrame( firstFrame );
  });
  
  // Show the calibration controls (axes, origin, ruler, track box)
  function showCalibrationControls() {
    canvas.add( xAxis );
    canvas.add( yAxis );
    canvas.add( axesOrigin );
    canvas.add( scaleLine );
    canvas.add( scaleCircle1 );
    canvas.add( scaleCircle2 );
    canvas.add( scaleBox );
    $("#distanceInput").show();
  }

  // Hide the calibration controls (axes, origin, ruler, track box)
  function hideCalibrationControls() {
    canvas.remove( xAxis );
    canvas.remove( yAxis );
    canvas.remove( axesOrigin );
    canvas.remove( scaleLine );
    canvas.remove( scaleCircle1 );
    canvas.remove( scaleCircle2 );
    canvas.remove( scaleBox );
    $("#distanceInput").hide();
  }  

  /* ====== MEDIAINFO (FPS) SECTION ============
     Get the frame rate (fps) and rotation
     from the MediaInfo library
     =========================================== */    

  // Get the frame rate and the rotation from the MediaInfo library 
  function getFPS() {
    $('#statusMsg').html( "Calculating frame rate... <i class='fa fa-spinner fa-spin fa-fw'></i>" );
       
    // Callback function to get the results back from MediaInfo
    let MI;
    let getResults = function() {

      // Update orientation/rotation
      videoRotation = MI.Get(MediaInfoModule.Stream.Video, 0, 'Rotation');
      if( iOS() && videoRotation ) {        
        if( Math.abs(90 - videoRotation) < 1 ) {
          $("#orientationInput").val( "90" );
        } else if( Math.abs(180 - videoRotation ) < 1 ) {
          $("#orientationInput").val( "180" );
        } else if( Math.abs(270 - videoRotation ) < 1 ) { 
          $("#orientationInput").val( "270" );
        }
        canvasVideoCtx.save(); // save unrotated state
        rotateContext();
      }
      
      // Update frame rate
      let frameRate = MI.Get(MediaInfoModule.Stream.Video, 0, 'FrameRate');
      updateFPS( frameRate );

      // Finalize
      MI.Close();
      MI.delete();
    }
              
    // Initialise MediaInfo
    MI = new MediaInfoModule.MediaInfo();

    //Open the file
    try{
      const file = $('#videoInput').prop('files')[0];
      MI.Open(file, getResults);
    } catch (error) {
      alert("An error occured. Please set frame rate manually.\n" + error);
      $('#statusMsg').html( "" );
    }    
  }
  
  // Update the frame rate (fps)
  function updateFPS( rate ) {
    $("#fpsInput").val( rate );
    $("#fpsInput").change();
  }

  // Update the frame rate (fps) when user gives input or when calculated
  $("#fpsInput").change( function() {
    if( isNumeric(this.value) && toNumber(this.value) > 0 && dataCanBeRemoved() ) {

      // Remove status message
      $('#statusMsg').html( "" );   
      this.style.background = ""; // remove pink alert

      // Set the new FPS
      FPS = toNumber(this.value);

      // Clear raw data
      deleteRawData();
      
      if( video.src !== "" ) {
        // Update the slider
        $("#slider").attr("max", Math.round( ((video.duration-t0) * FPS).toFixed(1) ) - 1 );
    
        // Always reset to first frame
        if( !(video.src).endsWith( demoLocation ) ) gotoFrame( 0 );
        
        // Video can be enabled
        tryToEnable();
      }
    }
    this.value = FPS || "";
  });

  // Rotate the video context (only needed for iOS due to bug)
  function rotateContext() {
    canvasVideoCtx.restore(); // remove old rotation
    canvasVideoCtx.save();    // save for next time
    if( $("#orientationInput").val() == "0" ) return;
    
    let aspectRatio = video.videoWidth / video.videoHeight;
    if( $("#orientationInput").val() == "90" ) {
      canvasVideoCtx.rotate(Math.PI/2 );
      canvasVideoCtx.translate(0, -video.videoWidth );
      if( aspectRatio < 1 ) canvasVideoCtx.scale( 1/aspectRatio, 1);
      else canvasVideoCtx.scale( 1/aspectRatio, aspectRatio );
    } else if( $("#orientationInput").val() == "180" ) {
      canvasVideoCtx.rotate(Math.PI );
      canvasVideoCtx.translate(-video.videoWidth, -video.videoHeight );
    } else if( $("#orientationInput").val() == "270" ) { 
      canvasVideoCtx.rotate(-Math.PI/2 );
      canvasVideoCtx.translate(-video.videoHeight, 0 );
      if( aspectRatio < 1 ) canvasVideoCtx.scale( 1/aspectRatio, 1);
      else canvasVideoCtx.scale( 1/aspectRatio, aspectRatio );
    }
  }

  /* ========= CALIBRATION SECTION ============
     Calibration controls for the video analysis:
     - setting origin
     - setting scale with ruler or directly
     =========================================== */    
  
  // Update the origin when user gives input or when calculated
  $("#originXInput").change( function() {
    if( isNumeric(this.value) ) {
      originX = toNumber( this.value );
      
      // Update the y-axis on the canvas
      yAxis.set({x1: originX*zoomLevel, y1: 0, 
                 x2: originX*zoomLevel, y2: canvas.height} );
      yAxis.setCoords();
      axesOrigin.set({left: originX*zoomLevel });
      axesOrigin.setCoords();
      canvas.requestRenderAll();
      
      // Update plots
      updatePlots();
    }
    this.value = (typeof originX !== "undefined" ) ? originX : "";
  });
  $("#originYInput").change( function() {
    if( isNumeric(this.value) ) {
      originY = toNumber( this.value ) ;
      
      // Update the x-axis on the canvas
      xAxis.set({x1: 0, y1: originY*zoomLevel, 
                 x2: canvas.width, y2: originY*zoomLevel} );
      xAxis.setCoords();
      axesOrigin.set({top: originY*zoomLevel });
      axesOrigin.setCoords();
      canvas.requestRenderAll();

      // Update plots
      updatePlots();
    }
    this.value = (typeof originY !== "undefined" ) ? originY : "";
  });
  
  // update origin
  function updateOrigin(x,y) {
    $("#originXInput").val( x );
    $("#originYInput").val( y );
    $("#originXInput").change();
    $("#originYInput").change();
  }

  // Update the ruler's distanceInMeter when user gives input
  $("#distanceInput").change( function() {
    if( isNumeric(this.value) && toNumber(this.value) > 0 ) {
      distanceInMeter = toNumber( this.value );
      setScale();
    }
    this.value = distanceInMeter || "";
  });
  
  // update scale directly (in pixels per meter)
  function updateScale(scale) {
    $("#scaleInput").val( scale );
    $("#scaleInput").change();
  }

  // Update the scale when user gives input or when calculated
  $("#scaleInput").change( function() {
    if( isNumeric(this.value) && toNumber(this.value) > 0 ) {
      pixelsPerMeter = toNumber( this.value );   
      this.style.background = '';
      // Enable video analysis
      tryToEnable() ;
      // Set the distanceInMeter
      let scale1 = {x: scaleCircle1.left/zoomLevel, y: scaleCircle1.top/zoomLevel };
      let scale2 = {x: scaleCircle2.left/zoomLevel, y: scaleCircle2.top/zoomLevel };
      let dist = Math.sqrt((scale2.x-scale1.x)**2 + (scale2.y-scale1.y)**2);
      distanceInMeter = parseFloat( (dist / pixelsPerMeter).toPrecision(6) ) ;
      $("#distanceInput").val( distanceInMeter );
      // Update plots
      updatePlots();
    }
    this.value = pixelsPerMeter || "";
  });

  function tryToEnable() {
    if( video.src === "" ) return;
    if( $("#fpsInput").val() !== "" ) {
      enableVideoControl();
      if( $("#scaleInput").val() !== "" ) {
        $('#statusMsg').html("");
        enableAnalysis();
      } else {
        $('#statusMsg').html("Set the scale or the ruler length");        
      }
    }
  }
  
  function updateRuler( scaleX1, scaleY1, scaleX2, scaleY2 ) {
    scaleLine.set({x1: scaleX1*zoomLevel, y1: scaleY1*zoomLevel, 
                   x2: scaleX2*zoomLevel, y2: scaleY2*zoomLevel });
    scaleCircle1.set({left: scaleLine.x1, top: scaleLine.y1});
    scaleCircle2.set({left: scaleLine.x2, top: scaleLine.y2});
    scaleLine.setCoords();
    scaleCircle1.setCoords();
    scaleCircle2.setCoords();
    setScaleBox();
  }
  
  // Set the scale 
  function setScale() {
    // Check if distanceInMeter is set
    if( distanceInMeter ) {
      // Get the scale points
      let scale1 = {x: scaleCircle1.left/zoomLevel, y: scaleCircle1.top/zoomLevel };
      let scale2 = {x: scaleCircle2.left/zoomLevel, y: scaleCircle2.top/zoomLevel };

      // Update scale
      updateScale( Math.sqrt((scale2.x-scale1.x)**2 + (scale2.y-scale1.y)**2) / distanceInMeter );
    }
  }
    
  /* ======== VIDEO CONTROL SECTION ============
     Control the video with play/stop, next and
     prev functions
     =========================================== */    

  // Enable the video control buttons
  function enableVideoControl() {
    $('#prev').removeAttr('disabled');
    $('#play').removeAttr('disabled');
    $('#next').removeAttr('disabled');
    $('#slider').removeAttr('disabled');
    $("#zoomIn").removeAttr('disabled');
    $("#zoomOut").removeAttr('disabled');
    $('#showMediaInfo').removeAttr('disabled');
  }

  // Disable the video control buttons
  function disableVideoControl() {
    $('#prev').attr('disabled', '');
    $('#play').attr('disabled', '');
    $('#next').attr('disabled', '');
    $('#slider').attr('disabled', '');  
    $("#zoomIn").attr('disabled', '');
    $("#zoomOut").attr('disabled', '');
    $("#showMediaInfo").attr('disabled', '');
  }

  // Go to the previous frame
  $('#prev').click(function() { gotoFrame(currentFrame-1); });

  // Go to the next frame
  $('#next').click(function() { gotoFrame(currentFrame+1); });

  // Update the frame when slider changes
  $("#slider").change( function() { gotoFrame(Math.floor(this.value)); });

  // Play the video (not an essential functio, just to give the user a play button)
  let playIntervalID=0;
  let playing = false;
  $('#play').click(function() {
    $(this).find('.fa-play,.fa-pause').toggleClass('fa-pause').toggleClass('fa-play');
    if ( playing === false ) {
      playing = true;
      let that = this;
      playIntervalID = window.setInterval( function() {
        // Go to next frame until the end (when gotoFrame returns false)
        if( gotoFrame(currentFrame+1) == false ) {
          window.clearInterval( playIntervalID );
          playing = false;
          $(that).find('.fa-play,.fa-pause').toggleClass('fa-pause').toggleClass('fa-play');
        } 
      }, 1000/FPS );
    } else {
      playing = false;
      window.clearInterval( playIntervalID );    
    }
  });

  // Show the text on the video and remove it after 1 s
  let videoTimeoutID = 0;
  function flashTextOnVideo( text ) {
    $("#videoText").html( text );
    clearTimeout( videoTimeoutID ); // remove previous timeout
    videoTimeoutID = setTimeout( () =>{ $("#videoText").html( "" ); }, 1000 );
  }
  
  // Get the time from a frame number
  function getTime(targetFrame) {
    return FPS ? (t0 + (targetFrame + 0.5)/FPS) : 0 ;
  }

  // Move the video to the given target frame
  function gotoFrame(targetFrame) {
    let newTime = getTime( targetFrame );     
    if( newTime < t0 ) {
      return false;
    } else if( newTime > video.duration ) {
      return false;
    } else {
      // Draw the current time and remove it after 1 s
      flashTextOnVideo( newTime.toFixed(2) + " s" );
      
      // Highlight the new marker
      let currentDataPoint = rawData.find(entry => entry.t === currentFrame );
      if( currentDataPoint ) {
        unHighlightMarker( currentDataPoint.marker );
        if ( !drawAllPoints ) canvas.remove( currentDataPoint.marker );
      }
      let nextDataPoint = rawData.find(entry => entry.t === targetFrame );
      if( nextDataPoint ) {
        let nextMarker = nextDataPoint.marker;
        highlightMarker( nextMarker );
        if( !analysisStarted && automaticAnalysis ) {  // Also update track box
          trackBox.set({ left: nextMarker.left, top: nextMarker.top });
          trackBox.setCoords();
          roiBox.set({ left: roiOffsetX*zoomLevel + nextMarker.left, 
                        top: roiOffsetY*zoomLevel + nextMarker.top });
          roiBox.setCoords();
        }
      }
      canvas.requestRenderAll();
    
      currentFrame = targetFrame;
      video.currentTime = newTime;
      video.addEventListener("seeked", function(e) {
        // remove the handler or else it will draw another frame on the same canvas in next seek
        e.target.removeEventListener(e.type, arguments.callee); 
        
        canvasVideoCtx.drawImage(video,0,0);
        $('#frameNumber').html( currentFrame + " / " + $("#slider").attr("max") );
        $("#slider").val( currentFrame );
      });
      return true;
    }
  }
  
  // Show the video information in the video info modal
  function writeVideoInfo() {
    // Show video info
    let videoFile = $('#videoInput').prop('files')[0];
    let videoName = "", videoType = "", videoSize = "";
    if( typeof videoFile !== "undefined" ) {
      videoName = videoFile.name;
      videoType = videoFile.type;
      videoSize = formatBytes(videoFile.size);
    }
    let videoInfo = [{ "Name": videoName, "Duration": toCSV(video.duration)+" s", 
                       "Width": video.videoWidth + " px", "Height": video.videoHeight + " px",
                       "Rotation": videoRotation + "&deg;", "MIME type": videoType,
                       "File size": videoSize }];
    $("#videoInfo").html( convertToTable( videoInfo )  );
  }
  
  // Make a nice looking table from the video info object
  function convertToTable(tracks) {
    let output = "\n <table>";
    tracks.forEach(track => {
      for (const [key, value] of Object.entries(track)) {
        if( key === "Name" ) {
          output += `<tr class="table-header"><th colspan=2>${value}</th></tr>\n`;
        } else {
          output += `<tr><td>${key}</td><td>${value}</td></tr>\n`;
        }
      }
    } );
    output += "</table>";  
    return output;
  }

  /* ============ ZOOMING SECTION ====================
     Zooming in and out on the video
     ================================================= */

  $("#zoomOut").click( () => {
    if( canvas.width > 200 ) { // minimum 200 px should be small enough
      setVideoZoom( 0.5*canvas.width / video.videoWidth );
      $("#zoomIn").removeAttr('disabled');
      if( canvas.width <= 200 ) $("#zoomOut").attr('disabled', '');
    }
  });

  $("#zoomIn").click( () => {
    if( canvas.width*canvas.height < 4e6 ) { // Maximum canvas size: 16 Mpx
      setVideoZoom( 2*canvas.width / video.videoWidth );
      $("#zoomOut").removeAttr('disabled');
      if( canvas.width*canvas.height >= 4e6 ) $("#zoomIn").attr('disabled', '');
    }
  });
  
  // The actual zooming function
  function setVideoZoom( newZoom ) {
    // Calculate the relative zoom and save the previous zoom level
    let relZoom = newZoom / zoomLevel;
    let prevZoom = zoomLevel;
        
    // Update to new zoom level
    zoomLevel = newZoom;

    // Update the drawing canvas
    canvas.setDimensions({ width: video.videoWidth * newZoom, 
                           height: video.videoHeight * newZoom })

    // Update axes
    axesOrigin.set({ left: newZoom * $("#originXInput").val(), 
                     top:  newZoom * $("#originYInput").val() });
    axesOrigin.setCoords();
    xAxis.set({x2: canvas.width, y1: axesOrigin.top, y2: axesOrigin.top} );
    yAxis.set({x1: axesOrigin.left, x2: axesOrigin.left, y2: canvas.height } );  
    xAxis.setCoords();
    yAxis.setCoords();

    // Update ruler
    updateRuler( scaleCircle1.left/prevZoom, scaleCircle1.top/prevZoom,
                 scaleCircle2.left/prevZoom, scaleCircle2.top/prevZoom );

    // Update track box
    trackBox.set({ left: trackBox.left * relZoom,
                       top: trackBox.top * relZoom, 
                     width: trackBox.width * relZoom, 
                    height: trackBox.height * relZoom });
    trackBox.setCoords();
    roiBox.set({ left: roiBox.left * relZoom,
                  top: roiBox.top * relZoom, 
                width: roiBox.width * relZoom, 
               height: roiBox.height * relZoom });
    roiBox.setCoords();
    
    // Update the data markers
    rawData.forEach( function (item) {
      item.marker.set({ left: item.marker.left * relZoom,
                         top: item.marker.top * relZoom});
      item.marker.setCoords();
    } );

    // Finally update the calibration canvas
    canvas.renderAll();
    
    // Update the video canvas
    canvasVideo.width = video.videoWidth * newZoom;
    canvasVideo.height = video.videoHeight * newZoom;
    canvasVideoCtx.scale(newZoom,newZoom);
    canvasVideoCtx.save(); // save unrotated state
    rotateContext(); // rotate context due to bug/feature in iOS    
    canvasVideoCtx.drawImage(video,0,0);
    
    // Show the current zoom level
    flashTextOnVideo( zoomLevel + "x" );
  }
  
  
  /* =========== ANALYSIS SECTION =============
     Enable/disable button
     =========================================== */    

  // Enable automatic analysis only when openCV is ready
  let openCVReady = false;
  $("#opencv").on("load", () => {
    cv['onRuntimeInitialized']=()=>{
      openCVReady = true;
      
      // Only enable the automatic analysis when Start analysis button is enabled
      if( !($("#startAnalysis").prop("disabled")) ) $("#automaticAnalysis").removeAttr('disabled');
      
      // For the demo: set automatic analysis to true
      if( (video.src).endsWith( demoLocation ) ) {
        $('#automaticAnalysis').prop('checked', true);
        $('#automaticAnalysis').change();
      }
    }
  });

  // Enable, disable and set "Start/Stop analysis" button
  let analysisStarted = false;
  function setStartAnalysis() {
    analysisStarted = false;
    $("#startAnalysis").text( "Start analysis" );
    $("#startAnalysis").addClass("button-on");
    $("#startAnalysis").removeClass("button-off");    
    if( openCVReady ) $("#automaticAnalysis").removeAttr('disabled');    
  }
  function setStopAnalysis() {
    analysisStarted = true;
    $("#startAnalysis").text( "Stop analysis" );
    $("#startAnalysis").addClass("button-off");
    $("#startAnalysis").removeClass("button-on");
    if( openCVReady ) $("#automaticAnalysis").attr('disabled','');    
  }  
  function enableAnalysis() {
    $("#startAnalysis").removeAttr('disabled');
    setStartAnalysis();
  }
  function disableAnalysis() {    
    $("#startAnalysis").attr('disabled', '');    
    setStartAnalysis();
    $('#statusMsg').html("");
  }
  
  // Event listener when clicking "Start/Stop analysis" button
  $("#startAnalysis").click( () => {

    // Stop the player in case it is still playing
    if( playing ) {
      $('#play').click();
      return;
    }

    if( analysisStarted === false ) {
      
      // Change the button to "Stop analysis"
      setStopAnalysis();

      // Hide calibration controls (origin, scale)
      hideCalibrationControls();

      if( automaticAnalysis ) {
        if( templateMatchMode == "JS_SQDIFF" ) {
          templateMatching_js();
        } else {
          templateMatching();
        }
      } else {
        $('#statusMsg').html( "Click on the object" );
      }
    } else {
      // Change the button to "Start analysis"
      setStartAnalysis();

      // Put back calibration controls
      showCalibrationControls();

      $('#statusMsg').html( "" );
    }    
  });

  // General function to add new data point
  function addRawData( rawDataPoint ) {
    
    // First data point: enable export-csv-data button and delete-data button
    if( rawData.length === 0 ) {
      $("#csvExport").removeAttr('disabled');
      $("#deleteData").removeAttr('disabled');
    }
    
    // Set the "data is saved" flag to false
    dataIsSaved = false;

    // Add a marker to the rawDataPoint
    let markerP = fabric.util.object.clone( markerPoint ) ;
    markerP.set({left: rawDataPoint.x * zoomLevel, top: rawDataPoint.y * zoomLevel });    
    if( rawDataPoint.t === currentFrame ) {
      highlightMarker( markerP );
      canvas.add( markerP );    
    } else if ( drawAllPoints ) { 
      canvas.add( markerP );    
    }
    rawDataPoint["marker"] = markerP;
    
    let thisIndex = rawData.findIndex(entry => entry.t >= rawDataPoint.t );
    if( thisIndex < 0 ) { // insert at the end 
      rawData.push( rawDataPoint );
    } else if ( rawData[thisIndex].t === rawDataPoint.t ) { // update old point
      canvas.remove( rawData[thisIndex].marker );
      rawData[thisIndex] = rawDataPoint;
    } else { // insert new point at index
      rawData.splice(thisIndex, 0, rawDataPoint );
    }
  }
  
  // Get the physical position from the pixel-coordinate
  function getXYposition(posPx) {
    return {
      x: (posPx.x-originX)/pixelsPerMeter,       
      y: (originY-posPx.y)/pixelsPerMeter 
    };
  }  
    
  /* ========= MANUAL ANALYSIS SECTION =========
     Add a new data point on each click
     =========================================== */  
  
  // Detect when mouse is down (or when touchstart)
  let mouseIsDown = false;
  canvas.on('mouse:down', (evt) => {
    if( analysisStarted && !automaticAnalysis ) mouseIsDown = true;
  });

  // Reset mouseIsDown when mouse or touch moves (it could be a touch scrolling event)
  canvas.on('mouse:move', () => {
    if( analysisStarted && !automaticAnalysis && mouseIsDown) mouseIsDown = false;
  });

  // Add a data point when clicking on the canvas 
  canvas.on('mouse:up', (evt) => {
    if( analysisStarted && !automaticAnalysis && mouseIsDown) {
      mouseIsDown = false;
      addRawDataPoint(evt);
    }
  });
  
  function addRawDataPoint(evt) {
    // Get mouse position in pixels
    let posPx = canvas.getPointer( evt );

    // Add raw data
    let rawDataPoint = {t: currentFrame, x: posPx.x/zoomLevel, y: posPx.y/zoomLevel};
    addRawData( rawDataPoint );
    
    // Update plots
    updatePlots();
    
    // Go to next frame with a small delay
    setTimeout(function() { gotoFrame(currentFrame+framesToSkip); }, 200);
  }
 
  /* ======= AUTOMATIC ANALYSIS SECTION ========
     Two implementations of template matching:
     1. from OpenCV (select TM_XXX in mode)
     2. in pure JS (select JS_XXX)
     =========================================== */  

  // Convert image before template matching using the cvtColor mode
  function convertImage( image ) {
    if( imageConvMode == "HSV" ) {
      cv.cvtColor(image, image, cv.COLOR_RGBA2RGB);
      cv.cvtColor(image, image, cv.COLOR_RGB2HSV);
    } else if( imageConvMode == "GRAY" ) {
      cv.cvtColor(image, image, cv.COLOR_RGBA2GRAY,0);
    } else if( imageConvMode == "CANNY" ) {
      cv.cvtColor(image, image, cv.COLOR_RGBA2GRAY,0);
      cv.Canny(image, image, 10, 40, 3, true);
    }
  }
  
  // Create a rect in units of pixels (int) within the bounding area
  function createRect(x, y, width, height, frame){
    let rect = {};
    rect.x = Math.max(0, Math.floor(x-0.5*width));
    rect.y = Math.max(0, Math.floor(y-0.5*height));
    rect.width = Math.min( Math.floor(x+0.5*width), frame.cols ) - rect.x ;
    rect.height= Math.min( Math.floor(y+0.5*height), frame.rows ) - rect.y ;
    return rect;
  }
  
  
  // Automatic analysis
  function templateMatching() {
    
    $('#statusMsg').html( "Processing..." );
    disableVideoControl();
    
    // Make sure that the trackBox is not active anymore (just remove the controls)
    canvas.discardActiveObject().renderAll();
    
    // Set the matching mode    
    let mode = cv[ templateMatchMode ];
    
    // take first frame of the video
    let frame = cv.imread('canvasVideo');
    
    // initial location of window
    let xPos  = trackBox.left;
    let yPos  = trackBox.top;
    let boxWidth  = trackBox.width  * trackBox.scaleX;
    let boxHeight = trackBox.height * trackBox.scaleY;
    let trackWindow = createRect( xPos, yPos, boxWidth, boxHeight, frame );
    
    // Define offsets between trackBox (centered) and trackWindow (upperleft, top corner)
    let trackOffsetX = trackBox.left - trackWindow.x;
    let trackOffsetY = trackBox.top  - trackWindow.y;

    // set up the template for tracking
    let template = frame.roi(trackWindow);
    convertImage( template );
    let dst = new cv.Mat();
    let roi = new cv.Mat();
    frame.delete();
    
    function abortAnalysis() {
      // clean and stop.
      dst.delete(); template.delete();
      updatePlots();    
      enableVideoControl();
    } 
    
    let t0 = performance.now();
    let firstFrame = currentFrame;

    function processVideo() {
      try {  
        if (!analysisStarted) {
          abortAnalysis();
          console.log("OpenCV algorithm: mean time per frame = " + 
                      (performance.now() - t0)/(currentFrame-firstFrame) +" ms" );
          return;
        }

        // start processing.
        frame = cv.imread('canvasVideo');

        // Setup the region of interest (to narrow down the search)
        let roiWindow = {x: 0, y: 0, width: frame.cols, height: frame.rows };
        if( useROI ) { 
          roiWindow = createRect( roiBox.left, roiBox.top, roiBox.width*roiBox.scaleX,
                                  roiBox.height*roiBox.scaleY, frame);
        }
      
        // Convert the ROI and call the OpenCV template matching 
        roi = frame.roi( roiWindow );
        frame.delete();
        convertImage( roi );
        cv.matchTemplate( roi, template, dst, mode );
        
        // Get the position for the best match
        let result = cv.minMaxLoc(dst);
        let maxPoint = result.maxLoc;
        if( templateMatchMode.startsWith("TM_SQDIFF") ) maxPoint = result.minLoc;
        xPos  = roiWindow.x + maxPoint.x + trackOffsetX ;
        yPos  = roiWindow.y + maxPoint.y + trackOffsetY ;
        
        // Adaptive: update the template image from the new video frame
        if( adaptive ) {
          trackWindow.x = maxPoint.x; trackWindow.y = maxPoint.y;
          template.delete();
          template = roi.roi(trackWindow);
        }
        roi.delete();
                
        // For debugging: show template image in advanced mode
        if( $('#advanced').prop('checked') ) cv.imshow('templateCanvas', template );
        
        // Draw it on image
        trackBox.set({ left: xPos, top: yPos });
        trackBox.setCoords();
        roiBox.set({ left: xPos + roiOffsetX*zoomLevel , top: yPos + roiOffsetY*zoomLevel });
        roiBox.setCoords();

        // Add the data point
        let rawDataPoint = {t: currentFrame, x: xPos/zoomLevel, y: yPos/zoomLevel };
        addRawData( rawDataPoint );
    
        // Call the next processVideo as soon as video arrives to the new time
        setTimeout( function() {
          if( gotoFrame(currentFrame+framesToSkip) ) {
            video.addEventListener("seeked", function(e) {
              e.target.removeEventListener(e.type, arguments.callee); 
              processVideo();
            });
          } else {
            $("#startAnalysis").click();
            abortAnalysis();
          }
        }, 50 ); // small delay such that users see the new result
      } catch (err) {
        alert("An error occuring during the automatic analysis: "+err);
        $("#startAnalysis").click();
        abortAnalysis();
      }
    };

    // schedule the first one.
    setTimeout(processVideo, 0);
  }

  
  // Create a rect in units of pixels (int) within the bounding area
  function createRect_js(x, y, width, height){
    let rect = {};
    rect.x = Math.max(0, Math.floor(x-0.5*width));
    rect.y = Math.max(0, Math.floor(y-0.5*height));
    rect.width = Math.min( Math.floor(x+0.5*width), canvasVideo.width ) - rect.x ;
    rect.height= Math.min( Math.floor(y+0.5*height), canvasVideo.height ) - rect.y ;
    return rect;
  }

  // Automatic analysis: template matching in pure JS. Keep in mind that this is slow!
  function templateMatching_js() {
    
    $('#statusMsg').html( "Processing..." );
    disableVideoControl();
    
    // Make sure that the trackBox is not active anymore (just remove the controls)
    canvas.discardActiveObject().renderAll();
    
    // initial location of window
    let xPos  = trackBox.left;
    let yPos  = trackBox.top;
    let boxWidth  = trackBox.width  * trackBox.scaleX;
    let boxHeight = trackBox.height * trackBox.scaleY;
    let trackWindow = createRect_js( xPos, yPos, boxWidth, boxHeight );

    // Get the template image from the current frame
    let template = canvasVideoCtx.getImageData(trackWindow.x, trackWindow.y, 
                                               trackWindow.width, trackWindow.height);
    let templateData = template.data;

    // Define offsets between trackBox (centered) and trackWindow (upperleft, top corner)
    let trackOffsetX = trackBox.left - trackWindow.x;
    let trackOffsetY = trackBox.top  - trackWindow.y;
    
    // Store the width and height of the template image
    let templateWidth = template.width;
    let templateHeight = template.height;
    
    function abortAnalysis() {
      // clean and stop.
      updatePlots();    
      enableVideoControl();
    } 
    
    let t0 = performance.now();
    let firstFrame = currentFrame;

    function processVideo() {
      try {  
        if (!analysisStarted) {
          abortAnalysis();
          console.log("Pure JS algorithm: mean time per frame = " + 
                      (performance.now() - t0)/(currentFrame-firstFrame) +" ms" );

          return;
        }

        // Setup the region of interest (to narrow down the search)
        let roiWindow = {x: 0, y: 0, width: canvasVideo.width, height: canvasVideo.height };
        if( useROI ) { 
          roiWindow = createRect_js( roiBox.left, roiBox.top, roiBox.width*roiBox.scaleX,
                                     roiBox.height*roiBox.scaleY );
        }

        // Store the width and height of the ROI image
        let roiWidth = roiWindow.width;
        let roiHeight = roiWindow.height;

        // Get the ROI image from the current video frame
        let image = canvasVideoCtx.getImageData( roiWindow.x, roiWindow.y, 
                                                 roiWindow.width, roiWindow.height);
        let px = image.data;        

        // Template matching
        let bestMatch = {R: -1} ;
        let x = roiWidth-templateWidth;
        while( x-- ) {
          let y = roiHeight-templateHeight;
          while( y-- ) {    
            // Only SQDIFF is implemented for now
            let sqdiff = 0.0;
            let j = templateHeight;
            while( j-- ) {
              let i = templateWidth;
              while( i-- ) {
                const index   = 4*(i + j*templateWidth);
                const imIndex = 4*(x + i + (y + j)*roiWidth);
                sqdiff += ( templateData[index]   - px[imIndex] )**2;
                sqdiff += ( templateData[index+1] - px[imIndex+1] )**2;
                sqdiff += ( templateData[index+2] - px[imIndex+2] )**2;
              }
            }
            if( bestMatch.R < 0 || sqdiff < bestMatch.R ) {
              bestMatch.R = sqdiff;
              bestMatch.x = x;
              bestMatch.y = y;
            }
          } 
        }

        xPos  = roiWindow.x + bestMatch.x + trackOffsetX ;
        yPos  = roiWindow.y + bestMatch.y + trackOffsetY ;
        
        // Adaptive: not yet available
        /*if( adaptive ) {
          trackWindow.x = maxPoint.x; trackWindow.y = maxPoint.y;
          template.delete();
          template = roi.roi(trackWindow);
        }*/
                
        // TODO: not yet available
        //let tempCanvas = document.getElementById("templateCanvas");
        //let canvasContext = tempCanvas.getContext('2d');
        //cv.imshow('templateCanvas', template );
        
        // Draw it on image
        trackBox.set({ left: xPos, top: yPos });
        trackBox.setCoords();
        roiBox.set({ left: xPos + roiOffsetX*zoomLevel , top: yPos + roiOffsetY*zoomLevel });
        roiBox.setCoords();
  
        let rawDataPoint = {t: currentFrame, x: xPos/zoomLevel, y: yPos/zoomLevel };
        addRawData( rawDataPoint );    

        setTimeout( function() {
          if( gotoFrame(currentFrame+framesToSkip) ) {
            video.addEventListener("seeked", function(e) {
              e.target.removeEventListener(e.type, arguments.callee); 
              processVideo();
            });
          } else {
            $("#startAnalysis").click();
            abortAnalysis();
          }
        }, 50 );
      } catch (err) {
        alert("An error occuring during the automatic analysis: "+err);
        $("#startAnalysis").click();
        abortAnalysis();
      }
    };

    // schedule the first one.
    setTimeout(processVideo, 0);
  }

  /* ======== CHARTS PLOTTING SECTION ==========
     - Create graphs using Chart.js library
     - Update plots
     =========================================== */  

  // Options for the charts
  Chart.defaults.global.maintainAspectRatio = false;
  Chart.defaults.global.defaultFontSize = 12;   
  let options= { scales: { xAxes: [{ scaleLabel:{ labelString: 'time (s)', display: true},
                                     type: 'linear', position: 'bottom'}],
                           yAxes: [{ scaleLabel:{ labelString: 'Position (m)', display: true} }] },
                legend: { align: "end", labels: { boxWidth: 6, usePointStyle: true } } };

  // Position data
  let pData = { datasets: [{ label: 'x', fill: 'false', pointStyle: 'rect',
                             pointBackgroundColor: 'crimson', pointBorderColor: 'crimson',
                             borderColor: 'firebrick', borderWidth: 1 },
                           { label: 'y', fill: 'false', 
                             pointBackgroundColor: 'royalblue', pointBorderColor: 'royalblue',
                             borderColor: 'mediumblue', borderWidth: 1 }] };

  // Create the position chart
  let posCtx = document.getElementById('positionChart').getContext('2d');
  let positionChart = new Chart(posCtx, {
    type: 'line',
    data: pData,
    options: options
  });

  // Create the velocity chart
  let vData = { datasets: [{ label: 'x', fill: 'false', pointStyle: 'rect',
                             pointBackgroundColor: 'crimson', pointBorderColor: 'crimson',
                             borderColor: 'firebrick', borderWidth: 1  },
                           { label: 'y', fill: 'false', 
                             pointBackgroundColor: 'royalblue', pointBorderColor: 'royalblue',
                             borderColor: 'mediumblue', borderWidth: 1 }] };

  let velocityCtx = document.getElementById('velocityChart').getContext('2d');
  let velocityChart = new Chart(velocityCtx, {  
    type: 'line',
    data: vData,
    options: options
  });
  velocityChart.options.scales.yAxes[0].scaleLabel.labelString = "Velocity (m/s)";

  // Create the acceleraion chart
  let aData = { datasets: [{ label: 'x', fill: 'false', pointStyle: 'rect',
                             pointBackgroundColor: 'crimson', pointBorderColor: 'crimson',
                             borderColor: 'firebrick', borderWidth: 1  },
                           { label: 'y', fill: 'false', 
                             pointBackgroundColor: 'royalblue', pointBorderColor: 'royalblue',
                             borderColor: 'mediumblue', borderWidth: 1 }] };

  let accelerationCtx = document.getElementById('accelerationChart').getContext('2d');
  let accelerationChart = new Chart(accelerationCtx, {  
    type: 'line',
    data: aData,
    options: options
  });
  accelerationChart.options.scales.yAxes[0].scaleLabel.labelString = "Acceleration (m/s²)";

  // Update all plots
  function updatePlots() {
    updatePositionPlot();
    updateVelocityPlot();
    updateAccelerationPlot();
  }
  
  // Update the position plot
  function updatePositionPlot() { 
    let xPositions = [];
    let yPositions = [];
    rawData.forEach(function (item, index) {
      let time = getTime( item.t );
      let pos = getXYposition( item );
      xPositions.push( {x: time, y: pos.x} );
      yPositions.push( {x: time, y: pos.y} );
    });
    positionChart.data.datasets[0].data = xPositions;
    positionChart.data.datasets[1].data = yPositions;
    positionChart.update();  
  }

  // Update the velocity plot
  function updateVelocityPlot() { 
    let xVelocities = [];
    let yVelocities = [];
    rawData.forEach(function (item, index) {
      if( index > integrationTime-1 ) {
        let velocity = getVelocity(index - integrationTime, index);
        xVelocities.push( {x: velocity.t, y: velocity.x} );
        yVelocities.push( {x: velocity.t, y: velocity.y} );
      }
    });
    velocityChart.data.datasets[0].data = xVelocities;
    velocityChart.data.datasets[1].data = yVelocities;
        
    // Set the time axis to be the same as the position chart
    velocityChart.options.scales.xAxes[0].ticks.suggestedMin = 
      positionChart.scales["x-axis-0"].min;
    velocityChart.options.scales.xAxes[0].ticks.suggestedMax = 
      positionChart.scales["x-axis-0"].max;
    
    velocityChart.update();  
  }

  // Calcuate the velocity from indeces of two raw data points
  function getVelocity(index1, index2){
    let pos2 = getXYposition( rawData[index2] );    
    let pos1 = getXYposition( rawData[index1] );
    let t2 = getTime( rawData[index2].t );
    let t1 = getTime( rawData[index1].t );
    let dt = t2 - t1;
    let meanT = 0.5*( t1 + t2 );
    let velocityX = (pos2.x - pos1.x ) / dt;
    let velocityY = (pos2.y - pos1.y ) / dt;
    return { t: meanT, x : velocityX, y : velocityY }; 
  }

  // Update the acceletion plot
  function updateAccelerationPlot() { 
    let xAcceleration = [];
    let xVelocities = velocityChart.data.datasets[0].data;
    xVelocities.forEach(function (item, index) {
      if( index > integrationTime-1 ) {
        let acceleration = getAcceleration( xVelocities[index - integrationTime], item);
        xAcceleration.push( {x: acceleration.t, y: acceleration.a} );
      }
    });
    let yAcceleration = [];
    let yVelocities = velocityChart.data.datasets[1].data;
    yVelocities.forEach(function (item, index) {
      if( index > integrationTime-1 ) {
        let acceleration = getAcceleration( yVelocities[index - integrationTime], item);
        yAcceleration.push( {x: acceleration.t, y: acceleration.a} );
      }
    });
    accelerationChart.data.datasets[0].data = xAcceleration;
    accelerationChart.data.datasets[1].data = yAcceleration;
    
    // Set the time axis to be the same as the position chart
    accelerationChart.options.scales.xAxes[0].ticks.suggestedMin =
      positionChart.scales["x-axis-0"].min;
    accelerationChart.options.scales.xAxes[0].ticks.suggestedMax = 
      positionChart.scales["x-axis-0"].max;


    accelerationChart.update();  
  }

  // Calcuate the acceleration from velocity objects
  function getAcceleration(velocity1, velocity2){
    let dt = velocity2.x - velocity1.x;
    let meanT = 0.5*( velocity1.x + velocity2.x );
    let acceleration = (velocity2.y - velocity1.y ) / dt;
    return { t: meanT, a : acceleration }; 
  }
  
  // Draw and/or update the chart in the modal box
  let modalChart;
  function showModalChart( thisCanvas ) { 

    // Get the right chart
    let chart;
    Chart.helpers.each(Chart.instances, function(instance){
      if( instance.canvas == thisCanvas ) chart = instance;
    });
    if( !chart ) return;
    
    // create a new chart (only on first click) or just update
    if( (typeof modalChart === "undefined" ) ) {
      ctx = document.getElementById("modalChart").getContext('2d') ;
      modalChart = new Chart(ctx, {
        type: chart.config.type,
        data: chart.config.data, 
        options: chart.config.options
      });
    } else { // update
      modalChart.data = chart.config.data;
      modalChart.options = chart.config.options;
      modalChart.update();   
    } 
  } 

  
})();

