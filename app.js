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
    
    // Initial Profile Registration
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

// --- UNIFIED TAB NAVIGATION ---
async function switchTab(tabId) {
    const content = document.getElementById('tab-content');
    
    // Update active UI state for nav buttons
    document.querySelectorAll('.bottom-nav button').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`nav-${tabId}`) || document.querySelector(`button[onclick*="${tabId}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // Route to correct screen logic
    if (tabId === 'random') {
        renderRandomTab(content);
    } else if (tabId === 'people') {
        renderPeopleTab(content);
        // loadFriends() would go here if defined
    } else if (tabId === 'profile') {
        renderProfileTab(content);
        loadProfileData();
    } else if (tabId === 'chats') {
        content.innerHTML = `<div style="padding:20px;"><h3>Messages</h3><p>Friend and Group chats appearing soon...</p></div>`;
    } else if (tabId === 'groups') {
        content.innerHTML = `<div style="padding:20px;"><h3>Groups</h3><p>Join public groups or create your own.</p></div>`;
    }
}

// --- RENDER LOGIC ---
function renderRandomTab(container) {
    container.innerHTML = `
        <div class="video-grid">
            <video id="remoteVideo" autoplay></video>
            <video id="myVideo" autoplay muted></video>
        </div>
        <div style="padding: 10px; display: flex; gap: 5px; background: #1e293b; padding-bottom: 80px;">
            <button onclick="startRandomMatch('video')" style="flex:1;">Video Chat</button>
            <button onclick="startRandomMatch('text')" style="flex:1; background:#6366f1; color:white;">Text Chat</button>
        </div>`;
    setupMedia();
}

function renderProfileTab(container) {
    container.innerHTML = `
        <div class="glass-card" style="margin-top:20px;">
            <h3>Your Profile</h3>
            <input id="p-username" placeholder="Username" style="width:100%; margin-bottom:10px;">
            <select id="p-gender" style="width:100%; margin-bottom:10px;">
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
            </select>
            <select id="p-looking" style="width:100%; margin-bottom:10px;">
                <option value="male">Looking for Male</option>
                <option value="female">Looking for Female</option>
                <option value="any">Looking for Anyone</option>
            </select>
            <input id="p-interests" placeholder="Interests (comma separated)" style="width:100%; margin-bottom:10px;">
            <button onclick="saveProfile()" class="btn-primary">Save Profile</button>
        </div>`;
}

function renderPeopleTab(container) {
    container.innerHTML = `
        <div style="padding:20px; padding-bottom:100px;">
            <h3>Find People</h3>
            <div style="display:flex; gap:5px;">
                <input id="search-uid" placeholder="Enter Username" style="flex:1;">
                <button style="width:auto;">🔍</button>
            </div>
            <p style="font-size:12px; color:#94a3b8; margin-top:10px;">Your User ID: ${currentUser.id}</p>
        </div>`;
}

// --- MATCHMAKING ENGINE ---
async function startRandomMatch(mode) {
    let timer = 0;
    const maxWait = 15;
    
    await supabaseClient.from('profiles').update({ status: 'waiting', peer_id: peer.id }).eq('id', currentUser.id);

    const searchLoop = setInterval(async () => {
        timer++;
        
        // Use the "Relaxed Filter" RPC function
        const { data } = await supabaseClient.rpc('find_random_match', { 
            my_id: currentUser.id,
            f_gender: document.getElementById('p-looking')?.value || 'any' 
        });

        if (data?.length > 0 || timer >= maxWait) {
            clearInterval(searchLoop);
            const targetPeerId = data?.[0]?.target_peer_id;
            
            if (targetPeerId) {
                const call = peer.call(targetPeerId, myStream);
                setupCallHandlers(call);
            } else {
                alert("Searching broadly... Please wait for a connection.");
            }
        }
    }, 1000);
}

// --- DATA HANDLERS ---
async function saveProfile() {
    const updates = {
        id: currentUser.id,
        username: document.getElementById('p-username').value,
        gender: document.getElementById('p-gender').value,
        looking_for: document.getElementById('p-looking').value,
        interests: document.getElementById('p-interests').value.split(','),
        updated_at: new Date()
    };
    const { error } = await supabaseClient.from('profiles').upsert(updates);
    if (error) alert(error.message); else alert("Profile Updated!");
}

async function loadProfileData() {
    const { data } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
    if (data) {
        document.getElementById('p-username').value = data.username || "";
        document.getElementById('p-gender').value = data.gender || "male";
        document.getElementById('p-looking').value = data.looking_for || "any";
        document.getElementById('p-interests').value = data.interests?.join(',') || "";
    }
}

async function setupMedia() {
    try {
        myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('myVideo').srcObject = myStream;
    } catch (e) {
        console.error("Camera access denied", e);
    }
}

function setupCallHandlers(call) {
    currentCall = call;
    call.on('stream', remoteStream => {
        document.getElementById('remoteVideo').srcObject = remoteStream;
    });
}

peer.on('call', call => {
    call.answer(myStream);
    setupCallHandlers(call);
});
