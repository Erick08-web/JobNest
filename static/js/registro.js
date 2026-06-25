/*********** lógica de la aplicación ***********/
document.addEventListener('DOMContentLoaded', function() {

    /*********** elementos del dom ***********/
    const loader = document.getElementById('loader');
    const registerForm = document.getElementById('registerForm');
    const selectedUserTypeInput = document.getElementById('selectedUserType');
    const typeOptions = document.querySelectorAll('.type-option');

    // campos comunes
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const confirmPasswordInput = document.getElementById('confirmPasswordInput');
    const termsCheck = document.getElementById('termsCheck');

    const emailError = document.getElementById('emailError');
    const passwordError = document.getElementById('passwordError');
    const confirmPasswordError = document.getElementById('confirmPasswordError');
    const termsError = document.getElementById('termsError');

    // elementos para mostrar/ocultar contraseña
    const togglePassword = document.querySelector('#passwordInput + .toggle-password');
    const toggleConfirmPassword = document.querySelector('#confirmPasswordInput + .toggle-password');

    // campos de persona
    const firstNameInput = document.getElementById('firstNameInput');
    const lastNamePInput = document.getElementById('lastNamePInput');
    const lastNameMInput = document.getElementById('lastNameMInput');
    const candidatePhoneInput = document.getElementById('candidatePhoneInput');

    const firstNameError = document.getElementById('firstNameError');
    const lastNamePError = document.getElementById('lastNamePError');
    const lastNameMError = document.getElementById('lastNameMError');
    const candidatePhoneError = document.getElementById('candidatePhoneError');

    // elementos de la alerta personalizada
    const customAlert = document.getElementById('customAlert');
    const customAlertMessage = document.getElementById('customAlertMessage');
    const customAlertClose = document.getElementById('customAlertClose');

    // Variable para almacenar el tipo seleccionado
    let tipoSeleccionado = null;

    /*********** lógica del loader ***********/
    window.addEventListener('load', () => {
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
        }, 500);
    });

    function showLoader(message) {
        loader.querySelector('p').textContent = message;
        loader.style.display = 'flex';
        loader.style.opacity = '1';
    }

    function hideLoader() {
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
        }, 500);
    }

    /*********** funciones para la alerta personalizada ***********/
    function showCustomAlert(message) {
        customAlertMessage.textContent = message;
        customAlert.classList.add('show');
    }

    function hideCustomAlert() {
        customAlert.classList.remove('show');
    }

    customAlertClose.addEventListener('click', hideCustomAlert);

    /*********** funciones de utilidad ***********/
    function showError(element, message) {
        element.textContent = message;
        element.style.display = 'block';
        const parentDiv = element.closest('.mb-3');
        if (parentDiv) {
            const input = parentDiv.querySelector('input');
            const inputGroup = parentDiv.querySelector('.input-group');
            const checkbox = parentDiv.querySelector('input[type="checkbox"]');
            if (inputGroup) {
                inputGroup.querySelector('input').classList.add('is-invalid');
            } else if (input) {
                input.classList.add('is-invalid');
            } else if (checkbox) {
                checkbox.classList.add('is-invalid');
            }
        }
    }

    function hideError(element) {
        element.textContent = '';
        element.style.display = 'none';
        const parentDiv = element.closest('.mb-3');
        if (parentDiv) {
            const input = parentDiv.querySelector('input');
            const inputGroup = parentDiv.querySelector('.input-group');
            const checkbox = parentDiv.querySelector('input[type="checkbox"]');
            if (inputGroup) {
                inputGroup.querySelector('input').classList.remove('is-invalid');
            } else if (input) {
                input.classList.remove('is-invalid');
            } else if (checkbox) {
                checkbox.classList.remove('is-invalid');
            }
        }
    }

    function isValidEmail(email) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email);
    }

    function capitalizeFirstLetter(string) {
        if (!string) return '';
        return string.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    }

    function isValidPersonNameField(inputElement, errorElement, fieldName) {
        let value = inputElement.value.trim();
        const lettersSpacesAccentsRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;

        if (value === '') {
            showError(errorElement, `${fieldName} es obligatorio.`);
            return false;
        } else if (!lettersSpacesAccentsRegex.test(value)) {
            showError(errorElement, `Solo se permiten letras, espacios y acentos en ${fieldName.toLowerCase()}.`);
            return false;
        } else if (value.split(' ').filter(word => word !== '').length > 1 && (fieldName === 'apellido paterno' || fieldName === 'apellido materno')) {
            showError(errorElement, `Solo se permite un apellido en el campo de ${fieldName.toLowerCase()}.`);
            return false;
        } else {
            hideError(errorElement);
            return true;
        }
    }

    function isValidPhoneNumber(inputElement, errorElement, fieldName) {
        let value = inputElement.value;
        const digitsOnlyRegex = /^[0-9]+$/;
        if (value !== '' && !digitsOnlyRegex.test(value)) {
            showError(errorElement, `Solo se permiten números en ${fieldName.toLowerCase()}.`);
            return false;
        } else {
            hideError(errorElement);
            return true;
        }
    }

    function isValidPassword(password) {
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        if (password.length < minLength) {
            return 'La contraseña debe tener al menos 8 caracteres.';
        }
        if (!hasUpperCase) {
            return 'La contraseña debe contener al menos una letra mayúscula.';
        }
        if (!hasNumber) {
            return 'La contraseña debe contener al menos un número.';
        }
        if (!hasSpecialChar) {
            return 'La contraseña debe contener al menos un carácter especial (!@#$%^&*(),.?:{}|<>).';
        }
        return '';
    }

    function setupPasswordToggle(inputElement, toggleButton) {
        if (!toggleButton) return;
        toggleButton.addEventListener('click', function() {
            const icon = this.querySelector('i');
            if (inputElement.type === 'password') {
                inputElement.type = 'text';
                icon.classList.remove('bi-eye-fill');
                icon.classList.add('bi-eye-slash-fill');
            } else {
                inputElement.type = 'password';
                icon.classList.remove('bi-eye-slash-fill');
                icon.classList.add('bi-eye-fill');
            }
        });
    }

    /*********** SELECCIÓN DEL TIPO DE CUENTA (BOTONES GRANDES) ***********/
    typeOptions.forEach(option => {
    option.addEventListener('click', function() {
        typeOptions.forEach(opt => opt.classList.remove('selected'));
        this.classList.add('selected');
        tipoSeleccionado = this.getAttribute('data-type');
        selectedUserTypeInput.value = tipoSeleccionado;
        registerForm.style.display = 'block';
        // Ocultar los botones de selección
        document.querySelector('.user-type-selection').classList.add('hide');
    });
});

    /*********** validación en tiempo real ***********/
    function addValidationOnBlurAndInput(inputElement, validationFunction, errorElement, fieldName) {
        inputElement.addEventListener('blur', () => {
            validationFunction(inputElement, errorElement, fieldName);
        });
        inputElement.addEventListener('input', () => {
            validationFunction(inputElement, errorElement, fieldName);
        });
    }

    addValidationOnBlurAndInput(firstNameInput, isValidPersonNameField, firstNameError, 'nombre(s)');
    addValidationOnBlurAndInput(lastNamePInput, isValidPersonNameField, lastNamePError, 'apellido paterno');
    addValidationOnBlurAndInput(lastNameMInput, isValidPersonNameField, lastNameMError, 'apellido materno');
    addValidationOnBlurAndInput(candidatePhoneInput, isValidPhoneNumber, candidatePhoneError, 'número de teléfono');

    emailInput.addEventListener('input', () => {
        if (emailInput.value === '') {
            hideError(emailError);
        } else if (!isValidEmail(emailInput.value)) {
            showError(emailError, 'Introduce un correo electrónico válido (ej. usuario@dominio.com).');
        } else {
            hideError(emailError);
        }
    });
    emailInput.addEventListener('blur', () => {
        if (emailInput.value === '') {
            showError(emailError, 'El correo electrónico es obligatorio.');
        } else if (!isValidEmail(emailInput.value)) {
            showError(emailError, 'Introduce un correo electrónico válido (ej. usuario@dominio.com).');
        } else {
            hideError(emailError);
        }
    });

    passwordInput.addEventListener('input', () => {
        const validationMessage = isValidPassword(passwordInput.value);
        if (validationMessage) {
            showError(passwordError, validationMessage);
        } else {
            hideError(passwordError);
        }
        if (confirmPasswordInput.value !== '') {
            if (confirmPasswordInput.value !== passwordInput.value) {
                showError(confirmPasswordError, 'Las contraseñas no coinciden.');
            } else {
                hideError(confirmPasswordError);
            }
        }
    });

    passwordInput.addEventListener('blur', () => {
        const validationMessage = isValidPassword(passwordInput.value);
        if (validationMessage) {
            showError(passwordError, validationMessage);
        } else {
            hideError(passwordError);
        }
    });

    confirmPasswordInput.addEventListener('input', () => {
        if (confirmPasswordInput.value === '') {
            hideError(confirmPasswordError);
        } else if (confirmPasswordInput.value !== passwordInput.value) {
            showError(confirmPasswordError, 'Las contraseñas no coinciden.');
        } else {
            hideError(confirmPasswordError);
        }
    });
    confirmPasswordInput.addEventListener('blur', () => {
        if (confirmPasswordInput.value === '') {
            showError(confirmPasswordError, 'Confirma tu contraseña.');
        } else if (confirmPasswordInput.value !== passwordInput.value) {
            showError(confirmPasswordError, 'Las contraseñas no coinciden.');
        } else {
            hideError(confirmPasswordError);
        }
    });

    termsCheck.addEventListener('change', () => {
        if (termsCheck.checked) hideError(termsError);
    });

    /*********** envío del formulario ***********/
    registerForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        if (!tipoSeleccionado) {
            showCustomAlert('Por favor, selecciona si eres Prestador o Cliente.');
            return;
        }

        // limpiar errores previos
        document.querySelectorAll('.error-message').forEach(el => hideError(el));
        document.querySelectorAll('.form-control, .form-check-input').forEach(el => el.classList.remove('is-invalid'));

        let isValid = true;

        const formData = new FormData(registerForm);
        const data = {};
        formData.forEach((value, key) => {
            data[key] = typeof value === 'string' ? value.trim() : value;
        });
        data.userType = tipoSeleccionado;

        data.firstName = capitalizeFirstLetter(data.firstName);
        data.lastNameP = capitalizeFirstLetter(data.lastNameP);
        data.lastNameM = capitalizeFirstLetter(data.lastNameM);

        // validaciones
        if (data.email === '') {
            showError(emailError, 'El correo electrónico es obligatorio.');
            isValid = false;
        } else if (!isValidEmail(data.email)) {
            showError(emailError, 'Introduce un correo electrónico válido (ej. usuario@dominio.com).');
            isValid = false;
        }

        const passwordValidation = isValidPassword(data.password);
        if (passwordValidation) {
            showError(passwordError, passwordValidation);
            isValid = false;
        }

        if (data.confirmPassword === '') {
            showError(confirmPasswordError, 'Confirma tu contraseña.');
            isValid = false;
        } else if (data.confirmPassword !== data.password) {
            showError(confirmPasswordError, 'Las contraseñas no coinciden.');
            isValid = false;
        }

        if (!termsCheck.checked) {
            showError(termsError, 'Debes aceptar los términos y condiciones.');
            isValid = false;
        }

        if (!isValidPersonNameField(firstNameInput, firstNameError, 'nombre(s)')) isValid = false;
        if (!isValidPersonNameField(lastNamePInput, lastNamePError, 'apellido paterno')) isValid = false;
        if (!isValidPersonNameField(lastNameMInput, lastNameMError, 'apellido materno')) isValid = false;
        if (data.candidatePhone !== '' && !isValidPhoneNumber(candidatePhoneInput, candidatePhoneError, 'número de teléfono')) isValid = false;

        if (!isValid) {
            showCustomAlert('Por favor, corrige los errores en el formulario antes de continuar.');
            return;
        }

        showLoader('Registrando...');

        try {
            const response = await fetch('/registrar_usuario_web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();

            if (response.ok) {
                showCustomAlert('¡Registro exitoso! Ahora puedes iniciar sesión.');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);
            } else {
                hideLoader();
                if (result.errors) {
                    for (const field in result.errors) {
                        const errorElement = document.getElementById(`${field}Error`);
                        if (errorElement) {
                            showError(errorElement, result.errors[field]);
                        }
                    }
                    showCustomAlert('Por favor, corrige los errores indicados.');
                } else if (result.message) {
                    showCustomAlert(`Error: ${result.message}`);
                } else {
                    showCustomAlert('Ocurrió un error desconocido durante el registro.');
                }
            }
        } catch (error) {
            hideLoader();
            console.error('Error al enviar el formulario:', error);
            showCustomAlert('Error de conexión. Por favor, inténtalo de nuevo más tarde.');
        }
    });

    // Inicializar toggles de contraseña
    setupPasswordToggle(passwordInput, togglePassword);
    setupPasswordToggle(confirmPasswordInput, toggleConfirmPassword);
});