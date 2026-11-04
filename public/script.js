
const API = '/api/auth';

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const verifyForm = document.getElementById('verifyForm');
const forgotForm = document.getElementById('forgotForm');
const resetForm = document.getElementById('resetForm');

const authTitle = document.getElementById('authTitle');
const authMessage = document.getElementById('authMessage');
const switchText = document.getElementById('switchText');

function showForm(type) {
    const forms = {
        login: loginForm,
        register: registerForm,
        verify: verifyForm,
        forgot: forgotForm,
        reset: resetForm
    };

    Object.entries(forms).forEach(([name, form]) => {
        form.style.display = name === type ? 'grid' : 'none';
    });

    const titles = {
        login: 'Welcome Back',
        register: 'Create Account',
        verify: 'Verify Email',
        forgot: 'Forgot Password',
        reset: 'Reset Password'
    };

    authTitle.textContent = titles[type];
    authMessage.textContent = '';

    if (type === 'login') {
        switchText.style.display = 'block';
        switchText.innerHTML =
            `Don't have an account? <a href="#" id="showRegister">Sign Up</a>
            <br><br><a href="#" id="showForgot">Forgot Password?</a>`;
    } else if (type === 'register') {
        switchText.style.display = 'block';
        switchText.innerHTML =
            `Already have an account? <a href="#" id="showLogin">Login</a>`;
    } else if (type === 'verify') {
        switchText.style.display = 'none';
    } else {
        switchText.style.display = 'block';
        switchText.innerHTML =
            `<a href="#" id="showLogin">Back to Login</a>`;
    }
}

// NAVIGATION
switchText.addEventListener('click', function (e) {
    e.preventDefault();

    if (e.target.id === 'showRegister') {
        showForm('register');
    } else if (e.target.id === 'showLogin') {
        showForm('login');
    } else if (e.target.id === 'showForgot') {
        showForm('forgot');
    }
});

// REGISTER
registerForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const data = {
        name: document.getElementById('registerName').value.trim(),
        email: document.getElementById('registerEmail').value.trim(),
        password: document.getElementById('registerPassword').value
    };

    try {
        const response = await fetch(`${API}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            document.getElementById('verifyEmail').value = data.email;
            showForm('verify');
            authMessage.textContent = result.message;
        } else {
            authMessage.textContent = result.message;
        }
    } catch {
        authMessage.textContent = 'Server connection failed';
    }
});

// VERIFY EMAIL OTP
verifyForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    try {
        const response = await fetch(`${API}/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: document.getElementById('verifyEmail').value.trim(),
                otp: document.getElementById('otp').value.trim()
            })
        });

        const result = await response.json();

        if (response.ok) {
            showForm('login');
            authMessage.textContent = 'Email verified! Please login.';
        } else {
            authMessage.textContent = result.message;
        }
    } catch {
        authMessage.textContent = 'Server connection failed';
    }
});

// LOGIN
loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    try {
        const response = await fetch(`${API}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: document.getElementById('loginEmail').value.trim(),
                password: document.getElementById('loginPassword').value
            })
        });

        const result = await response.json();

        if (response.ok) {
            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(result.user));

            authMessage.textContent = 'Login successful!';

            window.location.href = '/dashboard.html';
        } else {
            authMessage.textContent = result.message;
        }
    } catch {
        authMessage.textContent = 'Server connection failed';
    }
});

// FORGOT PASSWORD
forgotForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const email = document.getElementById('forgotEmail').value.trim();

    try {
        const response = await fetch(`${API}/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const result = await response.json();

        if (response.ok) {
            document.getElementById('resetEmail').value = email;
            showForm('reset');
            authMessage.textContent = result.message;
        } else {
            authMessage.textContent = result.message;
        }
    } catch {
        authMessage.textContent = 'Server connection failed';
    }
});

// RESET PASSWORD
resetForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    try {
        const response = await fetch(`${API}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: document.getElementById('resetEmail').value.trim(),
                otp: document.getElementById('resetOTP').value.trim(),
                newPassword: document.getElementById('newPassword').value
            })
        });

        const result = await response.json();

        if (response.ok) {
            showForm('login');
            authMessage.textContent = 'Password reset successful. Please login.';
            resetForm.reset();
        } else {
            authMessage.textContent = result.message;
        }
    } catch {
        authMessage.textContent = 'Server connection failed';
    }
});

showForm('login');
