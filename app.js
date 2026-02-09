const SUPABASE_URL = 'https://mzpeonafplfyftuxybdj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_QD-aJKn3zAQys2OOjltEog_OJmL7QPd'; // Use your service_role or anon key here
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let peer = new Peer();
let myStream, user, currentCall;

// AUTHENTICATION
async function loginWithGoogle() {
    await supabase.auth.signInWithOAuth({ provider: 'google' });
}

async function guestLogin() {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) return alert("Connection Error: " + error.message);
    user = data.user;
    initApp();
}

function initApp() {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('main-screen').classList.add('active');
    switchTab('random');
}

// TAB NAVIGATION
function switchTab(tab) {
    const content = document.getElementById('tab-content');
    document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.remove('active'));
    
    if (tab === 'random') {
        content.innerHTML = `
            <div style="padding: 20px;">
                <video id="remoteVideo" class="video-box" autoplay></video>
                <button onclick="startMatching()" class="btn-next">Find Stranger</button>
                <p id="statusMsg" style="text-align:center;">Ready to chat</p>
            </div>`;
        initMedia();
    } else {
        content.innerHTML = `<h2 style="padding:20px;">${tab.toUpperCase()} Coming Soon</h2>`;
    }
}

async function initMedia() {
    myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
}

// MATCHMAKING (The 15-second Rule)
async function startMatching() {
    const status = document.getElementById('statusMsg');
    status.innerText = "Searching with filters...";
    
    let timer = 0;
    const maxFilterWait = 15;
    
    // Set self to waiting in DB
    await supabase.from('profiles').upsert({ id: user.id, status: 'waiting', peer_id: peer.id });
    
    const searchLoop = setInterval(async () => {
        timer++;
        
        // 1. Try finding match with RPC
        const { data } = await supabase.rpc('find_random_match', {
            my_id: user.id,
            f_gender: 'female' // Change based on UI selection
        });
        
        if (data?.length > 0 || timer >= maxFilterWait) {
            clearInterval(searchLoop);
            const targetPeerId = data?.[0]?.target_peer_id;
            
            if (targetPeerId) {
                connectTo(targetPeerId);
            } else {
                status.innerText = "No one found. Waiting for someone to call you...";
            }
        }
    }, 1000);
}

function connectTo(peerId) {
    currentCall = peer.call(peerId, myStream);
    currentCall.on('stream', (remoteStream) => {
        document.getElementById('remoteVideo').srcObject = remoteStream;
        document.getElementById('statusMsg').innerText = "Connected!";
    });
}

// Handle Incoming Calls
peer.on('call', (call) => {
    call.answer(myStream);
    call.on('stream', (remoteStream) => {
        document.getElementById('remoteVideo').srcObject = remoteStream;
        document.getElementById('statusMsg').innerText = "Connected!";
    });
});
