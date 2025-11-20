// Using native fetch (Node.js v18+)

const BASE_URL = 'http://localhost:3000';
let TOKEN = '';

async function login() {
    console.log('Testing Login...');
    try {
        const response = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin123' })
        });
        const data = await response.json();
        if (data.success) {
            console.log('✅ Login successful');
            TOKEN = data.token;
            return true;
        } else {
            console.error('❌ Login failed:', data);
            return false;
        }
    } catch (error) {
        console.error('❌ Login error:', error.message);
        return false;
    }
}

async function testSystemInfo() {
    console.log('\nTesting /system/info...');
    try {
        const response = await fetch(`${BASE_URL}/system/info`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        if (response.ok) {
            const data = await response.json();
            console.log('✅ System Info:', data);
        } else {
            console.error('❌ System Info failed:', response.status, await response.text());
        }
    } catch (error) {
        console.error('❌ System Info error:', error.message);
    }
}

async function testFiles() {
    console.log('\nTesting /files...');
    try {
        const response = await fetch(`${BASE_URL}/files`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        if (response.ok) {
            const data = await response.json();
            console.log(`✅ Files loaded: ${data.length} files`);
            return data;
        } else {
            console.error('❌ Files load failed:', response.status, await response.text());
            return [];
        }
    } catch (error) {
        console.error('❌ Files load error:', error.message);
        return [];
    }
}

async function run() {
    if (await login()) {
        await testSystemInfo();
        await testFiles();
    }
}

run();
