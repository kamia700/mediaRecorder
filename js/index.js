'use strict';
(function () {
  let audioRecorder = function() {
    //webkitURL is deprecated but nevertheless
    URL = window.URL || window.webkitURL;

    var gumStream; 						//stream from getUserMedia()
    var recorder; 						//MediaRecorder object
    var extension;
    const canvas = document.querySelector('.visualizer');
    const mainSection = document.querySelector('.main-controls');


    let audioCtx;
    const canvasCtx = canvas.getContext("2d");

    var recordButton = document.getElementById("recordButton");
    var stopButton = document.getElementById("stopButton");

    //add events to those 2 buttons
    recordButton.addEventListener("click", startRecording);
    stopButton.addEventListener("click", stopRecording);


    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')){
      extension="webm";
    }else{
      extension="ogg"
    }

    function startRecording() {
    var chunks = [];
    recordingsList.innerHTML = "";
    var constraints = {audio: true}

    recordButton.disabled = true;
    stopButton.disabled = false;

    navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
      gumStream = stream;
      recorder = new MediaRecorder(stream);
      visualize(stream);

      recorder.ondataavailable = function(e){
          chunks.push(e.data);
          if (recorder.state == 'inactive') {
            const blob = new Blob(chunks, { type: 'audio/'+extension, bitsPerSecond:128000});
            createDownloadLink(blob)
          }
      };

      recorder.onerror = function(e){
        console.log(e.error);
      }
      recorder.start(1000);
      }).catch(function(err) {
        console.log('The following error occured: ' + err);
    });
    }

    function stopRecording() {
      recorder.stop();
      gumStream.getAudioTracks()[0].stop();
      stopButton.disabled = true;
      recordButton.disabled = false;
    }

    function createDownloadLink(blob) {
      var url = URL.createObjectURL(blob);
      var au = document.createElement('audio');
      au.controls = true;
      au.src = url;
      recordingsList.appendChild(au);
    }

    function visualize(stream) {
      if(!audioCtx) {
        audioCtx = new AudioContext();
      }

      const source = audioCtx.createMediaStreamSource(stream);

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      source.connect(analyser);

      draw()

      function draw() {
        const WIDTH = canvas.width
        const HEIGHT = canvas.height;

        requestAnimationFrame(draw);

        analyser.getByteTimeDomainData(dataArray);

        canvasCtx.fillStyle = 'rgb(200, 200, 200)';
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = 'rgb(0, 0, 0)';

        canvasCtx.beginPath();

        let sliceWidth = WIDTH * 1.0 / bufferLength;
        let x = 0;


        for(let i = 0; i < bufferLength; i++) {

          let v = dataArray[i] / 128.0;
          let y = v * HEIGHT/2;

          if(i === 0) {
            canvasCtx.moveTo(x, y);
          } else {
            canvasCtx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        canvasCtx.lineTo(canvas.width, canvas.height/2);
        canvasCtx.stroke();

      }
    }

    window.onresize = function() {
      canvas.width = mainSection.offsetWidth;
    }

    window.onresize();
  }

  window.audioRecorder = {
    audioRecorder: audioRecorder
  };
})();


(function () {
  let videoRecorder = function() {
  // Spec is at http://dvcs.w3.org/hg/dap/raw-file/tip/media-stream-capture/RecordingProposal.html

    var constraints = {
      audio:true,
      video: {
        width: {
          min:640,
          ideal:640,
          max:640},
        height: {
          min:480,
          ideal:480,
          max:480 },
        framerate:60}};

    var recBtn = document.querySelector('button#rec');
    var stopBtn = document.querySelector('button#stop');

    var liveVideoElement = document.querySelector('#live');
    var playbackVideoElement = document.querySelector('#playback');
    var downloadLink = document.querySelector('a#downloadLink');

    liveVideoElement.controls = false;
    playbackVideoElement.controls=false;

    var mediaRecorder;
    var chunks = [];
    var localStream = null;
    var soundMeter  = null;
    var containerType = "video/webm"; //defaults to webm but we switch to mp4 on Safari 14.0.2+

    recBtn.addEventListener("click", onBtnRecordClicked);
    stopBtn.addEventListener("click", onBtnStopClicked);

    if (!navigator.mediaDevices.getUserMedia){
      alert('navigator.mediaDevices.getUserMedia not supported on your browser, use the latest version of Firefox or Chrome');
    } else {
      if (window.MediaRecorder == undefined) {
          alert('MediaRecorder not supported on your browser, use the latest version of Firefox or Chrome');
      } else {
        navigator.mediaDevices.getUserMedia(constraints)
          .then(function(stream) {
            localStream = stream;

            localStream.getTracks().forEach(function(track) {
              if(track.kind == "audio"){
                track.onended = function(event){
                  log("audio track.onended Audio track.readyState="+track.readyState+", track.muted=" + track.muted);
                }
              }
              if(track.kind == "video"){
                track.onended = function(event){
                  log("video track.onended Audio track.readyState="+track.readyState+", track.muted=" + track.muted);
                }
              }
            });

            liveVideoElement.srcObject = localStream;
            liveVideoElement.play();

            try {
              window.AudioContext = window.AudioContext || window.webkitAudioContext;
              window.audioContext = new AudioContext();
              } catch (e) {
              log('Web Audio API not supported.');
              }

              soundMeter = window.soundMeter = new SoundMeter(window.audioContext);
              soundMeter.connectToSource(localStream, function(e) {
              if (e) {
                log(e);
                return;
              }else{
                /*setInterval(function() {
                  log(Math.round(soundMeter.instant.toFixed(2) * 100));
                }, 100);*/
              }
              });

          }).catch(function(err) {
            /* handle the error */
            log('navigator.getUserMedia error: '+err);
          });
      }
    }

    function onBtnRecordClicked (){
      if (localStream == null) {
        alert('Could not get local stream from mic/camera');
      } else {
        recBtn.disabled = true;
        stopBtn.disabled = false;

        chunks = [];

        /* use the stream */
        if (typeof MediaRecorder.isTypeSupported == 'function'){
          /*
            MediaRecorder.isTypeSupported is a function announced in https://developers.google.com/web/updates/2016/01/mediarecorder
            and later introduced in the MediaRecorder API spec http://www.w3.org/TR/mediastream-recording/
          */
          if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
            var options = {mimeType: 'video/webm;codecs=vp9'};
          } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
            var options = {mimeType: 'video/webm;codecs=h264'};
          } else  if (MediaRecorder.isTypeSupported('video/webm')) {
            var options = {mimeType: 'video/webm'};
          } else  if (MediaRecorder.isTypeSupported('video/mp4')) {
            // Safari 14.0.2 has an EXPERIMENTAL version of MediaRecorder enabled by default
            containerType = "video/mp4";
            var options = {mimeType: 'video/mp4'};
          }
          log('Using '+ options.mimeType);
          mediaRecorder = new MediaRecorder(localStream, options);
        } else {
          log('isTypeSupported is not supported, using default codecs for browser');
          mediaRecorder = new MediaRecorder(localStream);
        }

        mediaRecorder.ondataavailable = function(e) {
          log('mediaRecorder.ondataavailable, e.data.size='+e.data.size);
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        mediaRecorder.onerror = function(e){
          log('mediaRecorder.onerror: ' + e);
        };

        mediaRecorder.onstart = function(){
          log('mediaRecorder.onstart, mediaRecorder.state = ' + mediaRecorder.state);

          localStream.getTracks().forEach(function(track) {
                  if(track.kind == "audio"){
                    log("onstart - Audio track.readyState="+track.readyState+", track.muted=" + track.muted);
                  }
                  if(track.kind == "video"){
                    log("onstart - Video track.readyState="+track.readyState+", track.muted=" + track.muted);
                  }
                });

        };

        mediaRecorder.onstop = function(){
          log('mediaRecorder.onstop, mediaRecorder.state = ' + mediaRecorder.state);
          var recording = new Blob(chunks, {type: mediaRecorder.mimeType});
          downloadLink.href = URL.createObjectURL(recording);

          // Even if they do, they may only support MediaStream
          playbackVideoElement.src = URL.createObjectURL(recording);
          playbackVideoElement.controls = true;

          var rand =  Math.floor((Math.random() * 10000000));
          switch(containerType){
            case "video/mp4":
              var name  = "video_"+rand+".mp4" ;
              break;
            default:
              var name  = "video_"+rand+".webm" ;
          }

          downloadLink.innerHTML = 'Download '+name;

          downloadLink.setAttribute( "download", name);
          downloadLink.setAttribute( "name", name);
        };

        mediaRecorder.onpause = function(){
          log('mediaRecorder.onpause, mediaRecorder.state = ' + mediaRecorder.state);
        }

        mediaRecorder.onresume = function(){
          log('mediaRecorder.onresume, mediaRecorder.state = ' + mediaRecorder.state);
        }

        mediaRecorder.onwarning = function(e){
          log('mediaRecorder.onwarning: ' + e);
        };
        mediaRecorder.start(1000);

        localStream.getTracks().forEach(function(track) {
          log(track.kind+":"+JSON.stringify(track.getSettings()));
          console.log(track.getSettings());
        })
      }
    }

    navigator.mediaDevices.ondevicechange = function(event) {
      log("mediaDevices.ondevicechange");
    }

    function onBtnStopClicked(){
      mediaRecorder.stop();
      recBtn.disabled = false;
      stopBtn.disabled = true;
    }

    function log(message){
      console.log(message)
    }

    function SoundMeter(context) {
      this.context = context;
      this.instant = 0.0;
      this.slow = 0.0;
      this.clip = 0.0;
      this.script = context.createScriptProcessor(2048, 1, 1);
      var that = this;
      this.script.onaudioprocess = function(event) {
      var input = event.inputBuffer.getChannelData(0);
      var i;
      var sum = 0.0;
      var clipcount = 0;
      for (i = 0; i < input.length; ++i) {
        sum += input[i] * input[i];
        if (Math.abs(input[i]) > 0.99) {
        clipcount += 1;
        }
      }
      that.instant = Math.sqrt(sum / input.length);
      that.slow = 0.95 * that.slow + 0.05 * that.instant;
      that.clip = clipcount / input.length;
      };
    }

    SoundMeter.prototype.connectToSource = function(stream, callback) {
      console.log('SoundMeter connecting');
      try {
      this.mic = this.context.createMediaStreamSource(stream);
      this.mic.connect(this.script);
      this.script.connect(this.context.destination);
      if (typeof callback !== 'undefined') {
        callback(null);
      }
      } catch (e) {
      console.error(e);
      if (typeof callback !== 'undefined') {
        callback(e);
      }
      }
    };
    SoundMeter.prototype.stop = function() {
      this.mic.disconnect();
      this.script.disconnect();
    };
  }

  window.videoRecorder = {
    videoRecorder: videoRecorder
  };
})();


let par = true;

let videoBlock = document.querySelector('.video');
let audioBlock = document.querySelector('.audio');

window.addEventListener('load', () => {
  if (par) {
    audioBlock.style.display = 'block';
    audioRecorder.audioRecorder();
  } else {
    videoBlock.style.display = 'block';
    videoRecorder.videoRecorder();
  }
})
