// Login Page JavaScript

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorAlert = document.getElementById('errorAlert');
    const errorMessage = document.getElementById('errorMessage');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            // Ẩn thông báo lỗi cũ
            errorAlert.style.display = 'none';

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok) {
                    // Đăng nhập thành công
                    Swal.fire({
                        icon: 'success',
                        title: 'Đăng nhập thành công!',
                        text: 'Đang chuyển hướng...',
                        timer: 1500,
                        showConfirmButton: false
                    }).then(() => {
                        window.location.href = '/dashboard';
                    });
                } else {
                    // Đăng nhập thất bại
                    errorMessage.textContent = data.message || 'Đăng nhập thất bại';
                    errorAlert.style.display = 'block';
                }
            } catch (error) {
                errorMessage.textContent = 'Lỗi kết nối đến server';
                errorAlert.style.display = 'block';
            }
        });
    }
});
