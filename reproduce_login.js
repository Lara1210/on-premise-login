async function testLogin() {
    try {
        console.log('Testing login with admin/admin123...');
        const response = await fetch('http://127.0.0.1:3000/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin123' })
        });

        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));

        if (response.ok && data.success) {
            console.log('✅ Login successful!');
        } else {
            console.log('❌ Login failed!');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

testLogin();
