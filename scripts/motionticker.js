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
  let video              = document.getElementById('video');
  let videoImage; // Fabric Image of video
  let canvasVideo = document.getElementById('canvasVideo');
  let canvasVideoCtx = canvasVideo.getContext('2d');
  canvasVideoCtx.save();
  
  // Global video parameters
  let currentFrame = 0;
  let t0 = 0;
  let zoomLevel = 1;
  let FPS;
  let pixelsPerMeter;
  let distanceInMeter;
  let originX, originY; // in pixels
  let videoRotation = 0; // in degrees

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

  /*function isQuicktime() {
    let videoFile = $('#videoInput').prop('files')[0];
    let videoType = (typeof videoFile === "undefined" ) ? "" : videoFile.type;
    return videoType.toLowerCase() === ("video/quicktime").toLowerCase();
  }*/

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
                                                   allowTouchScrolling: true,
                                                   preserveObjectStacking: true });
  fabric.Object.prototype.originX = fabric.Object.prototype.originY = 'center';
  let shadow = new fabric.Shadow({color: 'black', blur: 1 });  
  
  // Define marker style
  let markerPoint = new fabric.Circle({ radius: 3, stroke: 'rgba(220,0,0)', strokeWidth: 1, 
                                        fill: 'rgba(0,0,0,0)', shadow: shadow,
                                        selectable: false, evented: false });
  function highlightMarker( markerP ) { markerP.set({stroke: 'red', strokeWidth: 2}); }
  function unHighlightMarker( markerP ) { markerP.set({stroke: 'rgba(220,0,0)', strokeWidth: 1}); }
  
  // Define tracking box for automatic analysis
  let trackingBox = new fabric.Rect({left: -100, top: -100, height: 150, width: 150, 
                                     fill: 'rgba(0,0,0,0)', stroke: 'red', strokeWidth: 2,
                                     lockRotation: true, strokeUniform: true, noScaleCache: false,
                                     cornerSize: 8, cornerStyle: 'circle', 
                                     cornerColor: 'rgba(35,118,200)', shadow: shadow,
                                     hasBorders: false, selectable: true, evented: true });  
  trackingBox.setControlsVisibility({ mtr: false }); // Hide rotating point
  
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
    //let zoomLevel = canvas.width / video.videoWidth;
    $("#originXInput").val( axesOrigin.left / zoomLevel );
    $("#originYInput").val( axesOrigin.top / zoomLevel );
    $("#originXInput").change();
    $("#originYInput").change();
  });
  xAxis.on("moving", () => {
    axesOrigin.set({top: xAxis.top});
  });
  xAxis.on("moved", () => {
    //let zoomLevel = canvas.width / video.videoWidth;
    $("#originYInput").val( xAxis.top / zoomLevel );
    $("#originYInput").change();
  });
  yAxis.on("moving", () => {
    axesOrigin.set({left: yAxis.left});
  });
  yAxis.on("moved", () => {
    //let zoomLevel = canvas.width / video.videoWidth;
    $("#originXInput").val( yAxis.left / zoomLevel );
    $("#originXInput").change();
  });

  // Define ruler (line + 2 circles + box) for canvas
  let scaleLine = new fabric.Line( [100,10,100,110], {strokeWidth: 3, stroke: 'limegreen',
                                                  hasControls: false, hasBorders: false, 
                                                  padding: 10, shadow: shadow});    
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
  
  function setScaleBox() {    
    let length = Math.sqrt((scaleLine.x1-scaleLine.x2)**2 + (scaleLine.y1-scaleLine.y2)**2 );
    let xPos = scaleLine.left + (0.5*scaleBox.width+10)*(scaleLine.y2-scaleLine.y1)/length;
    let yPos = scaleLine.top + (0.5*scaleBox.height+10)*(scaleLine.x1-scaleLine.x2)/length;
    scaleBox.set({left: xPos, top: yPos });
    
    /*console.log("scalelin x,y = " +scaleLine.left+ ", "+ scaleLine.top )
    console.log("scaleBox x,y = " + xPos + ", " +yPos );
    console.log(scaleBox);
    */
    scaleBox.setCoords();


    
    //let zoomLevel = 1; //canvas.width / video.videoWidth;                               
    //$("#distanceInput").css({ transform: "scale("+ zoomLevel +")" });
    //console.log(distHeight);
    $("#distanceInput").css({ left: (xPos-6) + 8 - 0.5*scaleBox.width,
                               top: yPos - 0.5*distHeight });
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
      canvas.add( trackingBox );
    } else {
      canvas.remove( trackingBox );      
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
  
  let templateMatchMode = "TM_CCOEFF";
  $("#templateMatchMode").val( templateMatchMode );
  $("#templateMatchMode").change( function() { 
    templateMatchMode = this.value ;
  });
  
  let imageConvMode = "";
  $("#imageConvMode").val( imageConvMode );
  $("#imageConvMode").change( function() { 
    imageConvMode = this.value ;
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
  // END USER SETTINGS
  
  
  /* ==========  ====================
     
     ================================================= */

  
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
  
  // 
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

    // Update tracking box
    trackingBox.set({ left: trackingBox.left * relZoom,
                       top: trackingBox.top * relZoom, 
                     width: trackingBox.width * relZoom, 
                    height: trackingBox.height * relZoom });
    trackingBox.setCoords();
    
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

    // Format a number to get the decimal separator
    //const numberWithDecimalSeparator = 1.1;
    //return Intl.NumberFormat(locale)
    //    .formatToParts(numberWithDecimalSeparator)
    //    .find(part => part.type === 'decimal')
    //    .value;
  }
  
  function toCSV(number, precision = 6) {
    // Store numbers to 6 digits precision
    return number.toPrecision(precision).toString().replace('.',decimalSeparator);
  }

  // Settings for CSV
  let timeStr  = "time [s]";
  let posXStr  = "x position [m]";
  let posYStr  = "y position [m]";
  let velXStr  = "x velocity [m/s]";
  let velYStr  = "y velocity [m/s]";
  let accXStr  = "x acceleration [m/s²]";
  let accYStr  = "y acceleration [m/s²]";
  let fpsStr   = "Frame rate [Hz]";
  let origXStr = "x origin [px]";
  let origYStr = "y origin [px]";
  let scaleStr = "Scale [px/m]";
  let scaleX1Str = "Scale Point1 x [px]";
  let scaleY1Str = "Scale Point1 y [px]";
  let scaleX2Str = "Scale Point2 x [px]";
  let scaleY2Str = "Scale Point2 y [px]";
  let boxXStr  = "Tracking Box x [px]";
  let boxYStr  = "Tracking Box y [px]";
  let boxWStr  = "Tracking Box width [px]";
  let boxHStr  = "Tracking Box height [px]";
  
  // Event listener for export button
  $("#csvExport").click( () => {
    
    // Check if there is data to be written
    if( rawData.length === 0 ) return;
    
    // First line contains headers and meta data
    //let zoomLevel = canvas.width / video.videoWidth;
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
                  [boxXStr]: toCSV( trackingBox.left/zoomLevel ), 
                  [boxYStr]: toCSV( trackingBox.top/zoomLevel ),
                  [boxWStr]: toCSV( trackingBox.width/zoomLevel ), 
                  [boxHStr]: toCSV( trackingBox.height/zoomLevel )
                 }  );

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
  
  // When cvsImport is clicked (dummy button) ask if data can be removed and trigger csvInput  
  $("#csvImport").click( () => {
    if( dataCanBeRemoved() ) {      
      // Progagate to hidden DOM element
      hideDropdownMenu();
      $("#csvInput").click();
    }
  });
  
  // Add event listener for when csv-file is selected
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

          // Remove the marker from the canvas
          /*rawData.forEach(function (item) {
            canvas.remove( item.marker );
          });
          rawData = []; // Clear old data
          */
          deleteRawData(); // Clear old data

          // Update the header info
          let meta = results.data[0];
          updateFPS( toNumber( meta[fpsStr] ) );
          updateOrigin( toNumber( meta[origXStr] ), toNumber( meta[origYStr] ) );
          updateScale( toNumber( meta[scaleStr] )  );            

          // Update the ruler
          if( isNumeric( meta[scaleX1Str] ) && isNumeric( meta[scaleY1Str] ) &&
              isNumeric( meta[scaleX2Str] ) && isNumeric( meta[scaleY2Str] ) ) {
            updateRuler( toNumber( meta[scaleX1Str] ), toNumber( meta[scaleY1Str] ),
                         toNumber( meta[scaleX2Str] ), toNumber( meta[scaleY2Str] ) );
          }
          
          // Update the tracking box
          if( isNumeric( meta[boxXStr] ) && isNumeric( meta[boxYStr] ) &&
              isNumeric( meta[boxWStr] ) && isNumeric( meta[boxHStr] ) ) {
            //let zoomLevel = canvas.width / video.videoWidth;
            trackingBox.set({ left: toNumber( meta[boxXStr] )*zoomLevel, 
                               top: toNumber( meta[boxYStr] )*zoomLevel,
                             width: toNumber( meta[boxWStr] )*zoomLevel,
                             height:toNumber( meta[boxHStr] )*zoomLevel });
          }

          // Add raw data
          for(let i=1; i<results.data.length; ++i ){
            let item = results.data[i];

            // check not empty
            if( isNumeric(item[timeStr]) && isNumeric(item[posXStr]) && isNumeric(item[posYStr]) ) {
              let time = Math.floor( toNumber(item[timeStr])*FPS );
              let xPos = originX + toNumber(item[posXStr])*pixelsPerMeter;
              let yPos = originY - toNumber(item[posYStr])*pixelsPerMeter;
              let rawDataPoint = {t: time, x: xPos, y: yPos };  

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


  /* ============= Video SECTION =================
       Importing a video file
     =========================================== */  
  
  $("#videoImport").click( () => {
    if( dataCanBeRemoved() ) {      
      // Progagate to hidden DOM element
      hideDropdownMenu();
      $("#videoInput").click();
    }
  });
  
  // Add event listener for when file is selected
  $("#videoInput").change( function() {

    // Remove old source
    video.removeAttribute('src'); // empty source
    video.load();

    // Clear raw data and meta data
    deleteRawData();
    FPS = undefined;
    updateFPS();
    pixelsPerMeter = undefined;
    updateScale();
    $("#distanceInput").val("");
    originX = originY = undefined;
    updateOrigin();
    canvas.clear();
    
    canvasVideoCtx.restore(); // TODO: clear?
    $("#orientationInput").val("0"); 
    videoRotation = 0;
    
    // Disable video control and reset video parameters when selecting new video
    disableAnalysis();
    disableVideoControl();
    $('#frameNumber').html( "0 / 0" );
    $("#slider").attr("max", 0 );

    // Get the file
    let URL = window.URL || window.webkitURL;
    let file = this.files[0];
    video.src = URL.createObjectURL(file);
    //console.log("video src=" + video.src);
    
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
    disableAnalysis();
    disableVideoControl();
    $('#frameNumber').html( "0 / 0" );

    // Remove old source
    video.removeAttribute('src'); // empty source
    video.load();
  });
  
  
  // Prepare canvas size, calibration controls and set frame rate when meta data is available
  video.addEventListener('loadedmetadata', () => {

    // Pause the video (needed because of autoplay)
    video.pause();
    
    // Set the dimensions of the video and prepare the canvas
    setVideoZoom(1.0);
    
    // Set initial position for the origin, scale and trackingBox (relative to video dimensions)
    updateOrigin(0.1*video.videoWidth, 0.9*video.videoHeight);

    // TODO: This should get a better name
    updateRuler( 0.2*video.videoWidth, 0.3*video.videoHeight,
                 0.2*video.videoWidth, 0.7*video.videoHeight );
    trackingBox.set({left: 0.5*video.videoWidth, top: 0.3*video.videoHeight,
                     width: 0.1*video.videoWidth/trackingBox.scaleX, 
                     height: 0.1*video.videoHeight/trackingBox.scaleY });
    trackingBox.setCoords();
    
    // Highlight fields that need to be filled
    $("#scaleInput").css( "background", "pink");
    $("#fpsInput").css("background", "pink");
    
    // Put the graphics back
    showCalibrationControls();

    // Get the frame rate
    if( getMediaInfo ) getFPS();
    else $('#statusMsg').html("Set the frame rate manually");

  });
  
  // Show video when it has been loaded
  video.addEventListener('loadeddata', () => {
    gotoFrame( 0 );
  });
  
  function showCalibrationControls() {
    canvas.add( xAxis );
    canvas.add( yAxis );
    canvas.add( axesOrigin );
    canvas.add( scaleLine );
    canvas.add( scaleCircle1 );
    canvas.add( scaleCircle2 );
    canvas.add( scaleBox );
    if( automaticAnalysis ) canvas.add( trackingBox );
    $("#distanceInput").show();
  }

  function hideCalibrationControls() {
    canvas.remove( xAxis );
    canvas.remove( yAxis );
    canvas.remove( axesOrigin );
    canvas.remove( scaleLine );
    canvas.remove( scaleCircle1 );
    canvas.remove( scaleCircle2 );
    canvas.remove( scaleBox );
    //if( automaticAnalysis ) canvas.remove( trackingBox );
    $("#distanceInput").hide();
  }
    
  
  // Remove focus after enter for all input text elements
  let focusedElement;
  function blurOnEnter(e){ 
    if(e.keyCode===13){ 
      e.target.blur();
      focusedElement = null;
    } 
  }
  $("input[type=text]").on("keydown", blurOnEnter );

  // Put cursor always at last position when clicking on input text element
  $(document).on('focus', 'input', function () {    
    //already focused, return so user can now place cursor at specific point in input.    
    if (focusedElement == this) return; 
    focusedElement = this;
    // select all text in any field on focus for easy re-entry. 
    // Delay sightly to allow focus to "stick" before selecting.
    setTimeout(function () {focusedElement.setSelectionRange(9999,9999);}, 0);
  });

  
  function dataCanBeRemoved() {
    return (rawData.length == 0 || dataIsSaved ||
           confirm("This will clear your current data. Are you sure?") );
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
        $("#slider").attr("max", Math.floor( ((video.duration-t0) * FPS).toFixed(1) ) - 1 );
    
        // Always reset to first frame
        gotoFrame( 0 );
        
        // Video can be enabled
        tryToEnable();
      }
    } //else {
    this.value = FPS || "";
    //}
  });

  function updateFPS( rate ) {
    $("#fpsInput").val( rate );
    $("#fpsInput").change();
  }
  
  
  // Update the origin when user gives input or when calculated
  $("#originXInput").change( function() {
    if( isNumeric(this.value) ) {
      originX = toNumber( this.value );
      
      // Update the y-axis on the canvas
      //let zoomLevel = canvas.width / video.videoWidth;
      yAxis.set({x1: originX*zoomLevel, y1: 0, 
                 x2: originX*zoomLevel, y2: canvas.height} );
      yAxis.setCoords();
      axesOrigin.set({left: originX*zoomLevel });
      axesOrigin.setCoords();
      canvas.requestRenderAll();
      
      // Update plots
      updatePlots();
    } //else {
    this.value = (typeof originX !== "undefined" ) ? originX : "";
    //}
  });
  $("#originYInput").change( function() {
    if( isNumeric(this.value) ) {
      originY = toNumber( this.value ) ;
      
      // Update the x-axis on the canvas
      //let zoomLevel = canvas.width / video.videoWidth;
      xAxis.set({x1: 0, y1: originY*zoomLevel, 
                 x2: canvas.width, y2: originY*zoomLevel} );
      xAxis.setCoords();
      axesOrigin.set({top: originY*zoomLevel });
      axesOrigin.setCoords();
      canvas.requestRenderAll();

      // Update plots
      updatePlots();
    } //else {
    this.value = (typeof originY !== "undefined" ) ? originY : "";
    //}
  });
  
  
  // Update the scale when user gives input
  $("#distanceInput").change( function() {
    if( isNumeric(this.value) && toNumber(this.value) > 0 ) {
      distanceInMeter = toNumber( this.value );
      setScale();
    } //else {
    this.value = distanceInMeter || "";
    //}

  });
  
  
  // Update the scale when user gives input or when calculated
  $("#scaleInput").change( function() {
    if( isNumeric(this.value) && toNumber(this.value) > 0 ) {
      pixelsPerMeter = toNumber( this.value );   
      this.style.background = '';
      // Enable video analysis
      tryToEnable() ;
      // Set the distanceInMeter
      //let zoomLevel = canvas.width / video.videoWidth;
      let scale1 = {x: scaleCircle1.left/zoomLevel, y: scaleCircle1.top/zoomLevel };
      let scale2 = {x: scaleCircle2.left/zoomLevel, y: scaleCircle2.top/zoomLevel };
      let dist = Math.sqrt((scale2.x-scale1.x)**2 + (scale2.y-scale1.y)**2);
      distanceInMeter = parseFloat( (dist / pixelsPerMeter).toPrecision(6) ) ;
      $("#distanceInput").val( distanceInMeter );
      // Update plots
      updatePlots();
    } //else {
    this.value = pixelsPerMeter || "";
    //}
  });
  
  function tryToEnable() {
    if( video.src !== "" ) {
      if( $("#fpsInput").val() !== "" ) enableVideoControl();
      if( $("#fpsInput").val() !== "" && $("#scaleInput").val() !== "" ) enableAnalysis();
    }
  }
  
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
  
  // load all code after the document
  $("document").ready( () => {
    $("#videoImport").removeAttr('disabled');
    resizeWindow();
  });
  

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


  

  // Event listener for the modal boxes
  $("#showMediaInfo").click( evt => { writeVideoInfo(); showModal("mediaInfoModal"); });
  $("#showAbout").click( evt => { showModal("aboutModal");} );
  $("#showHelp").click( evt => { showModal("helpModal");} );
  $("#showSettings").click( evt => { showModal("settingsModal");} );

  /* Define functions for the modal box */
  let currentModal = "";

  // Showing modal box
  function showModal(name) {
    // Set the feedback tag
    setFeedback();

    let text = document.getElementById(name);
    text.style.display = "block";
    currentModal = name;
  }

  // When the user clicks on <span> (x), close the current modal
  let closeButtons = document.getElementsByClassName("close");
  for( var i=0; i < closeButtons.length; ++i) {
    closeButtons[i].onclick = function() {
      document.getElementById(currentModal).style.display = "none"; 
      currentModal = "";
    }
  }

  // When the user clicks anywhere outside of the modal, close it
  window.onclick = function(event) {
    if (event.target == document.getElementById(currentModal) ) {
      document.getElementById(currentModal).style.display = "none";
    }
  }

  // set the feedback tag
  function setFeedback() {
    var name = "smackjvantilburgsmack"; // add salt
    name = name.substr(5,11); // remove salt
    $("feedback").html(name+"@gmail.com");  
  }
    
  function getFPS() {
    $('#statusMsg').html( "Calculating frame rate... <i class='fa fa-spinner fa-spin fa-fw'></i>" );
       
    // Examples about how to get results
    let MI;
    let getResults = function() {

      // Update orientation/rotation
      videoRotation = MI.Get(MediaInfoModule.Stream.Video, 0, 'Rotation');
      if( iOS() && videoRotation ) {        
        if( Math.abs(90 - videoRotation) < 1 ) {
          $("#orientationInput").val( "90" );
          //console.log("found 90 cw");
        } else if( Math.abs(180 - videoRotation ) < 1 ) {
          $("#orientationInput").val( "180" );
          //console.log("found 180 cw");
        } else if( Math.abs(270 - videoRotation ) < 1 ) { 
          $("#orientationInput").val( "270" );
          //console.log("found 90 ccw");
        }
        canvasVideoCtx.save(); // save unrotated state
        rotateContext();
      }
      
      // Update frame rate
      let frameRate = MI.Get(MediaInfoModule.Stream.Video, 0, 'FrameRate');
      updateFPS( frameRate );

      // Finalize
      $('#statusMsg').html( "" );
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
    
    /*MediaInfo({ format: 'object' }, (mediainfo) => {
      const file = $('#videoInput').prop('files')[0];
      if (file) {        
        const getSize = () => file.size;

        const readChunk = (chunkSize, offset) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = (event) => {
              if (event.target.error) {
                reject(event.target.error);
              }
              resolve(new Uint8Array(event.target.result));
            }
            reader.readAsArrayBuffer(file.slice(offset, offset + chunkSize));
          });

          mediainfo.analyzeData(getSize, readChunk).then((result) => {
            $("#mediaInfoResult").html( convertToTable(result.media.track) );

            //console.log(result.media.track);
            result.media.track.forEach(track => {
              if( track["@type"] === "Video") {                        
                // Set the new FPS
                updateFPS( track.FrameRate );
                //fpsInput.value = track.FrameRate;
                //fpsInput.onchange();
                //$("#showMediaInfo").removeAttr("disabled");
                
                // Check orientation and set rotation
                if( iOS() && track.Rotation ) {
                  //videoImage.set( { angle: track.Rotation, originX: 'center', 
                  //                  originY: 'center', });
                  rotationAngle = track.Rotation;
                  rotateContext();
                }
                
                $('#statusMsg').html( "" );
              }
            } );
        })
          .catch((error) => {  
            alert("An error occured. Please set FPS manually.");
            $('#statusMsg').html( "" );
        })
      }
    })*/
  }
  
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

  function writeVideoInfo() {
    // Show video info
    let videoFile = $('#videoInput').prop('files')[0];
    let videoName = "", videoType = "", videoSize = "";
    if( typeof videoFile !== "undefined" ) {
      videoName = videoFile.name;
      videoType = videoFile.type;
      videoSize = formatBytes(videoFile.size);
    }
    let videoInfo = [{ "@type": videoName, "Duration": toCSV(video.duration)+" s", 
                       "Width": video.videoWidth + " px", "Height": video.videoHeight + " px",
                       "Rotation": videoRotation + "&deg;", "MIME type": videoType,
                       "File size": videoSize }];

    $("#videoInfo").html( convertToTable( videoInfo )  );
  }
  
  function convertToTable(tracks) {
    let output = "\n <table>";
    tracks.forEach(track => {
      //if( track["@type"] === "Video") {
      for (const [key, value] of Object.entries(track)) {
        if( key === "@type" ) {
          output += `<tr class="table-header"><th colspan=2>${value}</th></tr>\n`;
        } else {
          output += `<tr><td>${key}</td><td>${value}</td></tr>\n`;
        }
      }
    } );
    output += "</table>";
    
    return output;
  }
  
  
  $('#prev').click(function() {
    // Go to next frame
    gotoFrame(currentFrame-1);
  });

  $('#next').click(function() {
    // Go to next frame
    gotoFrame(currentFrame+1);
  });

  
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
  
  $("#slider").change( function() {
    // Go to next frame
    gotoFrame(Math.floor(this.value));
  });


  let canvasClick = "";
    
  canvas.on('mouse:up', (evt) => {
    if( canvasClick === "addRawDataPoint" ) {
      addRawDataPoint(evt);
    } 
  });
        
  // update origin
  function updateOrigin(x,y) {
    $("#originXInput").val( x );
    $("#originYInput").val( y );
    $("#originXInput").change();
    $("#originYInput").change();
  }
  
  function updateRuler( scaleX1, scaleY1, scaleX2, scaleY2 ) {
    //let zoomLevel = canvas.width / video.videoWidth;
    scaleLine.set({x1: scaleX1*zoomLevel, y1: scaleY1*zoomLevel, 
                   x2: scaleX2*zoomLevel, y2: scaleY2*zoomLevel });
    scaleCircle1.set({left: scaleLine.x1, top: scaleLine.y1});
    scaleCircle2.set({left: scaleLine.x2, top: scaleLine.y2});
    scaleLine.setCoords();
    scaleCircle1.setCoords();
    scaleCircle2.setCoords();
    setScaleBox();
    //updateScale(scale);
  }
  
  // Set the scale 
  function setScale() {
    
    // Check if distanceInMeter is set
    if( distanceInMeter ) {
      // Get the scale points
      //let zoomLevel = canvas.width / video.videoWidth;
      let scale1 = {x: scaleCircle1.left/zoomLevel, y: scaleCircle1.top/zoomLevel };
      let scale2 = {x: scaleCircle2.left/zoomLevel, y: scaleCircle2.top/zoomLevel };

      // Update scale
      updateScale( Math.sqrt((scale2.x-scale1.x)**2 + (scale2.y-scale1.y)**2) / distanceInMeter );
    }
  }
    
  // update scale
  function updateScale(scale) {
    $("#scaleInput").val( scale );
    $("#scaleInput").change();
  }

  // Enable automatic analysis only when openCV is ready
  let openCVReady = false;
  $("#opencv").on("load", () => {
    openCVReady = true;
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
    canvasClick = "";
  }
  
  // Event listener when clicking "Start/Stop analysis" button
  $("#startAnalysis").click( () => {
    if( analysisStarted === false ) {
      // Change the button to "Stop analysis"
      setStopAnalysis();

      // Hide calibration controls (origin, scale, trackingbox)
      hideCalibrationControls();

      if( automaticAnalysis ) {
        canvasClick = "";
        templateMatching();
      } else {
        $('#statusMsg').html( "Click on the object" );
        canvasClick = "addRawDataPoint";
      }
    } else {
      // Change the button to "Start analysis"
      setStartAnalysis();

      // Put back calibration controls
      showCalibrationControls();

      $('#statusMsg').html( "" );
      canvasClick = "";
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

  function updatePlots() {
    updatePositionPlot();
    updateVelocityPlot();
    updateAccelerationPlot();
  }
  
  function updatePositionPlot() { 
    let xPositions = [];
    let yPositions = [];
    rawData.forEach(function (item, index) {
      //console.log(item, index);
      let time = getTime( item.t );
      let pos = getXYposition( item );
      xPositions.push( {x: time, y: pos.x} );
      yPositions.push( {x: time, y: pos.y} );
    });
    positionChart.data.datasets[0].data = xPositions;
    positionChart.data.datasets[1].data = yPositions;
    positionChart.update();  
  }

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
    
    //console.log( positionChart.scales["x-axis-0"].max );
    //velocityChart.options.scales.yAxes[0].scaleLabel.labelString
    
    // Set the time axis to be the same as the position chart
    velocityChart.options.scales.xAxes[0].ticks.suggestedMin = 
      positionChart.scales["x-axis-0"].min;
    velocityChart.options.scales.xAxes[0].ticks.suggestedMax = 
      positionChart.scales["x-axis-0"].max;
    
    velocityChart.update();  
  }

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

  function getAcceleration(velocity1, velocity2){
    let dt = velocity2.x - velocity1.x;
    let meanT = 0.5*( velocity1.x + velocity2.x );
    let acceleration = (velocity2.y - velocity1.y ) / dt;
    return { t: meanT, a : acceleration }; 
  }
  
  function getTime(targetFrame) {
    return t0 + (targetFrame + 0.5)/FPS;
  }

  // Show the text on the video and remove it after 1 s
  let videoTimeoutID = 0;
  function flashTextOnVideo( text ) {
    $("#videoText").html( text );
    clearTimeout( videoTimeoutID ); // remove previous timeout
    videoTimeoutID = setTimeout( () =>{ $("#videoText").html( "" ); }, 1000 );
  }
  
  function gotoFrame(targetFrame) {
    let newTime = 0;
    if( FPS ) newTime = (targetFrame + 0.5)/FPS;
    
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
        if( !analysisStarted && automaticAnalysis ) {  // Also update tracking box
          trackingBox.set({ left: nextMarker.left, top: nextMarker.top });
          trackingBox.setCoords();
        }
      }
      canvas.requestRenderAll();
    
      currentFrame = targetFrame;
      video.currentTime = newTime;
      video.addEventListener("seeked", function(e) {
        e.target.removeEventListener(e.type, arguments.callee); // remove the handler or else it will draw another frame on the same canvas, when the next seek happens
        canvasVideoCtx.drawImage(video,0,0);
        $('#frameNumber').html( currentFrame + " / " + $("#slider").attr("max") );
        $("#slider").val( currentFrame );
      });
      return true;
    }
  }

  function getMousePos( evt ) {        

    //console.log(canvas);
    
    let rect = canvas.lowerCanvasEl.getBoundingClientRect();
    let scaleX = canvas.width / video.videoWidth;    // relationship bitmap vs. element for X
    let scaleY = canvas.height / video.videoHeight;  // relationship bitmap vs. element for Y
    
    return {
      x: (evt.clientX - rect.left)/scaleX,
      y: (evt.clientY - rect.top)/scaleY
    };
  }

  function getXYposition(posPx) {
    return {
      x: (posPx.x-originX)/pixelsPerMeter,       
      y: (originY-posPx.y)/pixelsPerMeter 
    };
  }  
    

  // TODO: temporarily add a canvas to display tracking window
  let tempCanvas = document.getElementById("tempCanvas");
  let canvasContext = tempCanvas.getContext('2d');

  // Convert image before template matching
  function convertImage( image ) {
    if( imageConvMode == "HSV" ) {
      cv.cvtColor(image, image, cv.COLOR_RGBA2RGB);
      cv.cvtColor(image, image, cv.COLOR_RGB2HSV);
    } else if( imageConvMode == "GRAY" ) {
      cv.cvtColor(image, image, cv.COLOR_RGBA2GRAY,0);
    } else if( imageConvMode == "CANNY" ) {
      cv.cvtColor(image, image, cv.COLOR_RGBA2GRAY,0);
      cv.Canny(image, image, 20, 50, 3, true);
    }
  }
  
  // Automatic analysis
  function templateMatching() {
    
    $('#statusMsg').html( "Processing..." );
    disableVideoControl();
    
    // Make sure that the trackingBox is not active anymore (just remove the controls)
    canvas.discardActiveObject().renderAll();
    
    // Set the matching mode    
    let mode = cv[ templateMatchMode ];
    
    // TODO: explain in help that best results are when analysing in original dimensions
    //setVideoZoom(1.0);
    
    // take first frame of the video
    let frame = cv.imread('canvasVideo');
    
    // initial location of window
    let boxWidth  = trackingBox.width  * trackingBox.scaleX;
    let boxHeight = trackingBox.height * trackingBox.scaleY;
    let boxX1     = trackingBox.left - 0.5*boxWidth;
    let boxY1     = trackingBox.top  - 0.5*boxHeight;
    let trackWindow = new cv.Rect(boxX1, boxY1, boxWidth, boxHeight );

    // Draw it on image
    /*let rect = new fabric.Rect({ left: trackingBox.left, 
                                 top: trackingBox.top, 
                                 width: boxWidth, height: boxHeight,
                                 fill: 'rgba(0,0,0,0)', stroke: 'red', strokeWidth: 2 });  
    canvas.add(rect);
    */

    // set up the ROI for tracking
    let roi = frame.roi(trackWindow);
    convertImage( roi );
    let dst = new cv.Mat();


    function abortAnalysis() {
      // clean and stop.
      frame.delete(); dst.delete(); roi.delete(); 
      //canvas.remove(rect);
      updatePlots();    
      enableVideoControl();
    } 
    
    function processVideo() {
      try {  
        if (!analysisStarted) {
          abortAnalysis();
          return;
        }

        // start processing.
        frame = cv.imread('canvasVideo');
        convertImage( frame );
        cv.matchTemplate(frame, roi, dst, mode);

        let result = cv.minMaxLoc(dst);
        let maxPoint = result.maxLoc;
        if( templateMatchMode.startsWith("TM_SQDIFF") ) maxPoint = result.minLoc;

        // Adaptive
        if( adaptive ) {
          let trackWindow2 = new cv.Rect(maxPoint.x, maxPoint.y, roi.cols, roi.rows);
          roi = frame.roi(trackWindow2);
        }
        let xPos  = maxPoint.x + 0.5*roi.cols;
        let yPos  = maxPoint.y + 0.5*roi.rows;
                
        cv.imshow('tempCanvas', roi );
        
        // Draw it on image
        //rect.set({ left: xPos, top: yPos });
        //rect.setCoords();
        trackingBox.set({ left: xPos, top: yPos });
        trackingBox.setCoords();
  
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
  
  
  // Plotting stuff
  let options= { scales: { xAxes: [{ scaleLabel:{ labelString: 'time (s)', 
                                                  display: true},
                                    type: 'linear', position: 'bottom'}],
                           yAxes: [{ scaleLabel:{ labelString: 'Position (m)', 
                                                  display: true} }] },
                legend: { align: "end", 
                          labels: { boxWidth: 6, usePointStyle: true } } };

  let pData = { datasets: [{ label: 'x', fill: 'false', pointStyle: 'rect',
                             pointBackgroundColor: 'crimson', pointBorderColor: 'crimson',
                             borderColor: 'firebrick', borderWidth: 1  },
                           { label: 'y', fill: 'false', 
                             pointBackgroundColor: 'royalblue', pointBorderColor: 'royalblue',
                             borderColor: 'mediumblue', borderWidth: 1 }] };

  //Chart.defaults.global.responsive = false;
  Chart.defaults.global.maintainAspectRatio = false;
  Chart.defaults.global.defaultFontSize = 12;
  
  let posCtx = document.getElementById('positionChart').getContext('2d');
  let positionChart = new Chart(posCtx, {
    type: 'line',
    data: pData,
    options: options
  });

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

  
  
})();

