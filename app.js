// CONFIGURATION
const SUPABASE_URL = 'https://mzpeonafplfyftuxybdj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_QD-aJKn3zAQys2OOjltEog_OJmL7QPd';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let peer = new Peer();
let myStream, currentUser, currentCall;

// --- AUTHENTICATION ---
async function guestLogin() {
    const { data, error } = await supabaseClient.auth.signInAnonymously();
    if (error) return alert(error.message);
    currentUser = data.user;
    
    // Register Profile
    await supabaseClient.from('profiles').upsert({ id: currentUser.id, status: 'offline' });
    
    initMainApp();
}

async function loginWithGoogle() {
    await supabaseClient.auth.signInWithOAuth({ 
        provider: 'google',
        options: { redirectTo: 'https://chanduvadlani.github.io/strangerpark/' }
    });
}

function initMainApp() {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('main-screen').classList.add('active');
    switchTab('random');
}

// --- TAB NAVIGATION ---
function switchTab(tabId) {
    const content = document.getElementById('tab-content');
    document.querySelectorAll('.bottom-nav button').forEach(btn => btn.classList.remove('active'));
    
    if (tabId === 'random') {
        content.innerHTML = `
            <div class="video-grid">
                <video id="remoteVideo" autoplay></video>
                <video id="myVideo" autoplay muted></video>
            </div>
            <div style="padding: 10px; display: flex; gap: 5px; background: #1e293b; padding-bottom: 80px;">
                <button onclick="startRandomMatch('video')" style="flex:1;">Video Chat</button>
                <button onclick="startRandomMatch('text')" style="flex:1; background:#6366f1; color:white;">Text Chat</button>
            </div>`;
        setupMedia();
    } else {
        content.innerHTML = `<div style="padding:20px;"><h2>${tabId.toUpperCase()}</h2><p>Feature coming soon...</p></div>`;
    }
}

async function setupMedia() {
    myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('myVideo').srcObject = myStream;
}

// --- MATCHMAKING (15-Second Relaxed Filter) ---
async function startRandomMatch(mode) {
    let timer = 0;
    const maxWait = 15;
    
    // Update status to waiting
    await supabaseClient.from('profiles').update({ status: 'waiting', peer_id: peer.id }).eq('id', currentUser.id);

    const searchLoop = setInterval(async () => {
        timer++;
        
        // Try strict match via RPC function
        const { data } = await supabaseClient.rpc('find_random_match', { 
            my_id: currentUser.id,
            f_gender: 'female' // Adjust based on user choice
        });

        if (data?.length > 0 || timer >= maxWait) {
            clearInterval(searchLoop);
            const targetPeerId = data?.[0]?.target_peer_id;
            
            if (targetPeerId) {
                const call = peer.call(targetPeerId, myStream);
                setupCallHandlers(call);
            } else {
                alert("No filtered match found within 15s. Waiting for anyone to connect...");
            }
        }
    }, 1000);
}

function setupCallHandlers(call) {
    currentCall = call;
    call.on('stream', remoteStream => {
        document.getElementById('remoteVideo').srcObject = remoteStream;
    });
}

// Handle Incoming Calls
peer.on('call', call => {
    call.answer(myStream);
    setupCallHandlers(call);
});
