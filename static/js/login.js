document.addEventListener('DOMContentLoaded', function() {
    // referencias a elementos del dom
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const emailError = document.getElementById('emailError');
    const passwordError = document.getElementById('passwordError');
    const loaderOverlay = document.getElementById('loaderOverlay');
    const pageLoaderOverlay = document.getElementById('pageLoaderOverlay');

    // elementos de la alerta personalizada
    const customAlert = document.getElementById('customAlert');
    const customAlertMessage = document.getElementById('customAlertMessage');
    const customAlertClose = document.getElementById('customAlertClose');

    // ocultar el loader de carga de página una vez que el dom está completamente cargado
    pageLoaderOverlay.classList.add('hidden');

    /*********** funciones para la alerta personalizada ***********/
    function showCustomAlert(message) {
        customAlertMessage.textContent = message;
        customAlert.classList.add('show');
    }

    function hideCustomAlert() {
        customAlert.classList.remove('show');
    }

    customAlertClose.addEventListener('click', hideCustomAlert);

    // función para mostrar mensajes de error
    function showError(element, message) {
        element.textContent = message;
        element.style.display = 'block';
        element.previousElementSibling.classList.add('is-invalid');
    }

    // función para ocultar mensajes de error
    function hideError(element) {
        element.textContent = '';
        element.style.display = 'none';
        element.previousElementSibling.classList.remove('is-invalid');
    }

    // funciones para mostrar y ocultar el loader de inicio de sesión
    function showLoader() {
        loaderOverlay.style.display = 'flex';
    }

    function hideLoader() {
        loaderOverlay.style.display = 'none';
    }

    // función para validar formato de correo electrónico
    function isValidEmail(email) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email);
    }

    // event listener para la validación en tiempo real (al escribir o cambiar el foco)
    emailInput.addEventListener('input', () => {
        if (emailInput.value.trim() === '') {
            hideError(emailError);
        } else if (!isValidEmail(emailInput.value.trim())) {
            showError(emailError, 'Introduce un correo electrónico válido (ej. usuario@dominio.com).');
        } else {
            hideError(emailError);
        }
    });

    emailInput.addEventListener('blur', () => {
        if (emailInput.value.trim() === '') {
            showError(emailError, 'El correo electrónico es obligatorio.');
        } else if (!isValidEmail(emailInput.value.trim())) {
            showError(emailError, 'Introduce un correo electrónico válido (ej. usuario@dominio.com).');
        } else {
            hideError(emailError);
        }
    });

    passwordInput.addEventListener('input', () => {
        if (passwordInput.value.trim() !== '') {
            hideError(passwordError);
        }
    });

    passwordInput.addEventListener('blur', () => {
        if (passwordInput.value.trim() === '') {
            showError(passwordError, 'La contraseña es obligatoria.');
        } else {
            hideError(passwordError);
        }
    });

    // event listener para la validación al intentar enviar el formulario
    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        hideError(emailError);
        hideError(passwordError);

        let isValid = true;

        if (emailInput.value.trim() === '') {
            showError(emailError, 'El correo electrónico es obligatorio.');
            isValid = false;
        } else if (!isValidEmail(emailInput.value.trim())) {
            showError(emailError, 'Introduce un correo electrónico válido (ej. usuario@dominio.com).');
            isValid = false;
        }

        if (passwordInput.value.trim() === '') {
            showError(passwordError, 'La contraseña es obligatoria.');
            isValid = false;
        }

        if (!isValid) {
            showCustomAlert('Por favor, ingresa credenciales válidas para iniciar sesión.');
            return;
        }

        showLoader();

        try {
            const formData = new FormData();
            formData.append('email', emailInput.value.trim());
            formData.append('password', passwordInput.value.trim());

            const response = await fetch('/login', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                showCustomAlert('¡Inicio de sesión exitoso! Bienvenido a JobNest.');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
            } else {
                hideLoader();
                if (result.message) {
                    showCustomAlert(result.message);
                } else {
                    showCustomAlert('Credenciales incorrectas. Por favor, inténtalo de nuevo.');
                }
            }
        } catch (error) {
            hideLoader();
            console.error('Error al enviar el formulario de login:', error);
            showCustomAlert('Error de conexión. Por favor, inténtalo de nuevo más tarde.');
        }
    });

    const video = document.querySelector('.video-column video');
    if (video) {
        // Intenta reproducir, si falla, muestra un mensaje silencioso
        video.play().then(() => {
            console.log('Video reproduciéndose');
        }).catch(error => {
            console.log('Autoplay bloqueado:', error);
            // Opcional: mostrar un mensaje sutil al usuario
        });
    }
});