/** 
240527 아이언맨 그림파일 추가
240528 성공, 실패, 시작 효과음 추가
240529 코드정리, 그림파일이 손 따라다니게 변경, 점수, 타이머실행, 게임 끝내기 
240623 랭킹표시, 게임 종료 후 재시작, 1등 이미지 캡쳐 후 표시 


추가할것 ball에 다른 점수, x 표시 더 넣기, 랭킹표시
오류수정 오른손만 원안에 인식해도 시작됨.
아이디어 색깔 다른 ball로 2인용 게임 만들기
**/

let video, model, d, lh, rh, handImageLeft, handImageRight, startSound, successSound, failureSound, interval;

let stats = false;
let timerStarted = false;
let counter = 3;
const TIME_LIMIT = 20;
let timer = TIME_LIMIT;
let startTime = 0;
// let score = 0;
let ball = [];
let b_ball = [];
let ball_num = 6;
let r = 300;
let total_score = 0;
let img;

function preload() {
  soundFormats('mp3');

  img = loadImage('sig.png');
  handImageLeft = loadImage('hand_icon_left.png'); // 왼손 이미지
  handImageRight = loadImage('hand_icon_right.png'); // 오른손 이미지

  startSound = loadSound('start.mp3');
  successSound = loadSound('success.mp3');
  failureSound = loadSound('failure.mp3');

  startSound.playMode('untilDone');
  successSound.playMode('restart');
  failureSound.playMode('restart');
}

function setup() {
  // 로컬스토리지 초기화
  localStorage.removeItem('scores');
  localStorage.removeItem('savedGameImage');
  let canvas = createCanvas(1080, 810);
  canvas.parent('canvas-container');
  frameRate(60);
  video = createCapture(VIDEO, () => {
    handsfree.start();
  });
  // video.size(640,480);
  video.hide();
  handsfree = new Handsfree({
    showDebug: false, // Comment this out to hide the default webcam feed with landmarks
    hands: true,
    maxNumHands: 2,
    setup: {
      video: {
        $el: video.elt,
      },
    },
  });

  // ball 생성할때 안겹치는 x, y 지정해서 생성
  for (let i = 0; i < ball_num; i++) {
    let pos = get_pos(ball);
    let text = i == ball_num - 1 ? 'X' : 'O';
    ball.push(new Ball(pos[0], pos[1], text));
  }
}

function mydrawCaptureCameraEffect() {
  //Draw camera centered with a semi transparect rect over
  push();
  imageMode(CENTER);
  translate(width, 0);
  scale(-1, 1);
  image(video, width * 0.5, height * 0.5, width, height);
  pop();
}

function draw() {
  background(0);
  if (frameCount < 180) {
    push();
    fill('white');
    textSize(45);
    textAlign(CENTER, CENTER);
    text('모델을 불러오고 있습니다.', width / 2, height / 2);
    pop();
    return;
  }

  mydrawCaptureCameraEffect();
  var hand = drawHands();
  if (hand) {
    var hands = hand[0];
  }
  if (hand && stats == false) {
    var r_hands = hand[1];
    var l_hands = hand[2];
    if (l_hands.every((h) => dist(width / 2 - 150, height / 2, h.x, h.y) < 150) && r_hands.every((h) => dist(width / 2 + 150, height / 2, h.x, h.y) < 150)) {
      console.log('start!!');
      if (!startSound.isPlaying()) {
        // 사운드가 이미 재생 중이 아니라면
        startSound.play(); // 시작 효과음 재생
      }

      stats = true;
    }
  }

  if (!stats) {
    imageMode(CENTER);
    image(handImageLeft, width / 2 - 150, height / 2, 100, 100);
    image(handImageRight, width / 2 + 150, height / 2, 100, 100);

    fill('white');
    textSize(45);
    textAlign(CENTER);
    text('손을 아크 안에 넣으세요.', width / 2, height - 100);
  } else if (stats) {
    if (hands && hands[0]) {
      // console.log(hands);
      image(handImageLeft, hands[0].x, hands[0].y, 100, 100);
    }
    if (hands && hands[1]) {
      // console.log(hands);
      image(handImageRight, hands[1].x, hands[1].y, 100, 100);
    }
  }

  if (stats && counter > 0) {
    //push();
    counter -= 1 / 60;
    fill('white');
    textSize(70);
    textAlign(CENTER);
    text(round(counter), width / 2, height / 2);
    return;
  }

  if (counter <= 0 && stats) {
    if (!timerStarted) {
      // [수정] 타이머가 시작되는 첫 프레임에만 시간 기록
      timerStarted = true;
      startTime = millis();
    }
  }

  if (timerStarted && timer > 0) {
    const elapsedTime = floor((millis() - startTime) / 1000);
    timer = max(0, TIME_LIMIT - elapsedTime);

    document.getElementById('timer').innerHTML = 'Time: ' + timer;
  }

  if (stats && counter <= 0) {
    for (let i = ball.length - 1; i >= 0; i--) {
      ball[i].show();
      hands?.forEach((h) => {
        if (h && ball[i]) {
          if (ball[i].hit(h) || ball[i].l >= 120) {
            if (ball[i].t === 'O') {
              successSound.play(); // O 볼을 제거할 때 성공 소리 재생
            } else {
              failureSound.play(); // X 볼을 제거할 때 실패 소리 재생
            }

            total_score += ball[i].score;
            updateScore(total_score);
            console.log('점수는 ' + total_score);
            var new_text = ball[i].t;
            ball.splice(i, 1);
            let pos = get_pos(ball);
            ball.push(new Ball(pos[0], pos[1], new_text));
          }
        }
      });
    }
  }

  if (timer <= 0) {
    startSound.stop();
    successSound.stop();
    failureSound.stop();

    let currentScore = total_score;
    let scores = JSON.parse(localStorage.getItem('scores')) || [];
    scores.sort((a, b) => b - a);
    console.log(scores);
    if (currentScore > scores[0] || scores.length === 0) {
      console.log(currentScore, score[0]);
      captureImage();
    }
    saveScore(currentScore);
    console.log(`Current Score: ${currentScore}`);
    // background(0);
    console.log('Time Over');
    displayGameOver(currentScore);
    noLoop();
    endGame();
  }

  image(img, width / 2 - 50, height * 0.95, width / 1.5, height / 8);
}

function captureImage() {
  let canvas = document.querySelector('canvas');
  let dataUrl = canvas.toDataURL('image/jpeg', 0.5);
  localStorage.setItem('savedGameImage', dataUrl);
}

function loadCaptureImage() {
  let savedImage = localStorage.getItem('savedGameImage');
  if (savedImage) {
    document.getElementById('game-capture').src = savedImage; // 이미지 표시
  }
}

function endGame() {
  setTimeout(() => {
    counter = 3;
    timer = TIME_LIMIT;
    total_score = 0;
    stats = false;
    timerStarted = false;
    updateScore(total_score);
    displayRanking();
    loadCaptureImage();

    getAudioContext().state !== 'running' && getAudioContext().resume();

    loop();
  }, 5000);
}

function displayRanking() {
  let scores = JSON.parse(localStorage.getItem('scores')) || [];
  scores.sort((a, b) => b - a);
  let rankingDiv = document.getElementById('ranking');
  rankingDiv.innerHTML = '<h3>Top Scores</h3>';
  for (let i = 0; i < Math.min(5, scores.length); i++) {
    rankingDiv.innerHTML += `<p>${i + 1}등: ${scores[i]}점</p>`;
  }
}

document.addEventListener('DOMContentLoaded', displayRanking);
document.addEventListener('DOMContentLoaded', loadCaptureImage);

function displayGameOver(score) {
  fill(255);
  textSize(48);
  textAlign(CENTER);
  textStyle(BOLD);
  text('Game Over', width / 2, height / 2);
  text('당신의 점수는 ' + score + '점 입니다.', width / 2, height / 2 + 60);
}

function updateScore(newScore) {
  document.getElementById('score').innerHTML = 'Score: ' + newScore;
}

function saveScore(score) {
  let scores = JSON.parse(localStorage.getItem('scores')) || [];
  scores.push(score);
  localStorage.setItem('scores', JSON.stringify(scores));
}

function drawHands() {
  fill(0);
  noStroke();

  if (handsfree.data.hands) {
    if (handsfree.data.hands.multiHandLandmarks) {
      var landmarks = handsfree.data.hands.multiHandLandmarks;
      var nHands = landmarks.length;

      var arr = [];
      var arr_r = [];
      var arr_l = [];
      for (var h = 0; h < nHands; h++) {
        for (var i = 0; i <= 21; i++) {
          var px = landmarks[h][i].x;
          var py = landmarks[h][i].y;
          px = map(px, 0, 1, width, 0);
          py = map(py, 0, 1, 0, height);
          if (h == 0) arr_r.push({ x: px, y: py });
          if (h == 1) arr_l.push({ x: px, y: py });
          if (i == 21) arr.push({ x: px, y: py });
          fill('white');
          circle(px, py, 10);
        }
      }
      // console.log(arr);
      return [arr, arr_r, arr_l];
    }
  }
}

function get_pos(ball) {
  let x = random(50, width - 50);
  let y = random(50, height - 50);

  while (ball.some((b) => dist(x, y, b.x, b.y) < 140)) {
    x = random(50, width - 50);
    y = random(50, height - 50);
  }

  return [x, y];
}

class Ball {
  constructor(_x, _y, _t) {
    this.x = _x;
    this.y = _y;
    this.r = 100;
    this.l = 0;
    this.t = _t;
    this.score = this.t == 'O' ? 10 : -10;
  }

  show() {
    fill(random(255), random(255), random(255), 150);
    arc(this.x, this.y, this.r, this.r, PI + PI / 2, PI + PI / 2 - (PI / 60) * this.l, PIE);
    //  j를 l로 변경
    fill('white');
    circle(this.x, this.y, this.r - 30);

    if (this.t == 'X') {
      fill('red');
      textSize(50);
      text('X', this.x, this.y + 18);
    }

    if (frameCount % 6 == 0) this.l++;
  }

  hit(a) {
    if (!a) return false;

    d = dist(this.x, this.y, a.x, a.y);

    return d < 55;

    //   if (d < 55) {
    //     return true;
    //   }
    //   return false;
    // }
  }
}
