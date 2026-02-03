// ================= FIREBASE CONFIG =================
const firebaseConfig = {
  apiKey: "AIzaSyDL27YgLcePboLFybnXMjeHGhsjSEvUGzk",
  authDomain: "strangerpark-chat-and-talk.firebaseapp.com",
  projectId: "strangerpark-chat-and-talk",
  storageBucket: "strangerpark-chat-and-talk.appspot.com",
  messagingSenderId: "104131882938",
  appId: "1:104131882938:web:f9e585d35421625bf37783"
};

// ✅ Initialize Firebase (ONLY ONCE)
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// ================= PEERJS =================
let peer = new Peer();
let conn = null;
let myPeerId = "";
let myStream = null;
let micOn = true;
let camOn = true;

peer.on("open", id => {
  myPeerId = id;
  console.log("Peer ID:", id);
});

// ================= AUTH =================
function register() {
  auth.createUserWithEmailAndPassword(email.value, password.value)
    .then(showProfile)
    .catch(e => alert(e.message));
}

function login() {
  auth.signInWithEmailAndPassword(email.value, password.value)
    .then(showProfile)
    .catch(e => alert(e.message));
}

function guest() {
  auth.signInAnonymously()
    .then(showProfile)
    .catch(e => alert(e.message));
}

function showProfile() {
  loginBox.style.display = "none";
  profileBox.style.display = "block";
}

// ================= MATCHING =================
async function startMatching() {
  if (!username.value || !gender.value || !looking.value) {
    alert("Please fill username, gender and looking-for");
    return;
  }

  const user = auth.currentUser;
  if (!user) return;

  const myData = {
    uid: user.uid,
    username: username.value,
    gender: gender.value,
    looking: looking.value,
    interest: interest.value,
    location: location.value,
    peerId: myPeerId,
    status: "waiting",
    time: Date.now()
  };

  await db.collection("users").doc(user.uid).set(myData);
  findMatch(myData);
}

async function findMatch(me) {
  let snap = await db.collection("users")
    .where("gender", "==", me.looking)
    .where("looking", "==", me.gender)
    .where("status", "==", "waiting")
    .limit(1)
    .get();

  if (!snap.empty) {
    let other = snap.docs[0];

    await db.collection("users").doc(me.uid).update({ status: "chatting" });
    await db.collection("users").doc(other.id).update({ status: "chatting" });

    conn = peer.connect(other.data().peerId);
    conn.on("open", startVideoChat);
  } else {
    setTimeout(() => findMatch(me), 3000);
  }
}

// ================= VIDEO + VOICE =================
async function getMedia() {
  myStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });
  myVideo.srcObject = myStream;
}

peer.on("call", call => {
  getMedia().then(() => {
    call.answer(myStream);
    call.on("stream", remoteStream => {
      remoteVideo.srcObject = remoteStream;
    });
  });
});

function startVideoChat() {
  profileBox.style.display = "none";
  chatBox.style.display = "block";

  getMedia().then(() => {
    let call = peer.call(conn.peer, myStream);
    call.on("stream", remoteStream => {
      remoteVideo.srcObject = remoteStream;
    });
  });
}

// ================= CONTROLS =================
function toggleMic() {
  if (!myStream) return;
  micOn = !micOn;
  myStream.getAudioTracks()[0].enabled = micOn;
}

function toggleCam() {
  if (!myStream) return;
  camOn = !camOn;
  myStream.getVideoTracks()[0].enabled = camOn;
}

async function nextStranger() {
  if (conn) conn.close();
  if (myStream) myStream.getTracks().forEach(t => t.stop());

  chatBox.style.display = "none";

  const user = auth.currentUser;
  if (user) {
    await db.collection("users").doc(user.uid).update({ status: "waiting" });
    startMatching();
  }
}
    alert("Username, gender & looking-for required");
    return;
  }

  localStorage.setItem("sp_profile", JSON.stringify(profile));
  alert("Profile saved");
}

function loadProfile() {
  let p = JSON.parse(localStorage.getItem("sp_profile"));
  if (!p) return;

  username.value = p.username;
  gender.value = p.gender;
  looking.value = p.looking;
  interest.value = p.interest;
  location.value = p.location;
}

/* CONNECTION */
function connectFriend() {
  let id = friendId.value.trim();
  if (!id) return alert("Enter ID");
  conn = peer.connect(id);
  conn.on("open", startChat);
}

/* CHAT */
function startChat() {
  chat.style.display = "block";

  conn.on("data", data => {
    if (data === "__typing__") {
      typing.innerText = "Stranger is typing...";
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => typing.innerText = "", 1000);
    } else {
      messages.value += "Stranger: " + data + "\n";
    }
  });

  conn.on("close", () => {
    messages.value += "❌ Disconnected\n";
  });
}

function sendMsg() {
  if (!conn) return;
  let msg = msgInput.value.trim();
  if (!msg) return;

  conn.send(msg);
  messages.value += "You: " + msg + "\n";
  msgInput.value = "";
}

msg.addEventListener("input", () => {
  if (conn) conn.send("__typing__");
});

function disconnect() {
  if (conn) conn.close();
  conn = null;
  chat.style.display = "none";
  messages.value = "";
  typing.innerText = "";
}

/* UI */
function toggleDark() {
  document.body.classList.toggle("dark");
}
