/* ==========================================================================
   INTERACTIVE SCRIPTS: Yêu Lại Tiếng Anh
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    // 1. NAVBAR SCROLL EFFECT
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // 2. FAQ ACCORDION
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const questionButton = item.querySelector('.faq-question');
        const answer = item.querySelector('.faq-answer');

        questionButton.addEventListener('click', () => {
            const isActive = item.classList.contains('active');

            // Close all other items
            faqItems.forEach(otherItem => {
                otherItem.classList.remove('active');
                otherItem.querySelector('.faq-answer').style.maxHeight = null;
            });

            // Toggle current item
            if (!isActive) {
                item.classList.add('active');
                answer.style.maxHeight = answer.scrollHeight + 'px';
            }
        });
    });

    // 3. CONDITIONAL INPUT FOR REFERRAL SOURCE
    const otherSourceCheck = document.getElementById('source-other-check');
    const otherSourceText = document.getElementById('source-other-text');

    if (otherSourceCheck && otherSourceText) {
        otherSourceCheck.addEventListener('change', () => {
            if (otherSourceCheck.checked) {
                otherSourceText.style.display = 'block';
                otherSourceText.required = true;
                otherSourceText.focus();
            } else {
                otherSourceText.style.display = 'none';
                otherSourceText.required = false;
                otherSourceText.value = '';
            }
        });
    }

    // 4. REGISTRATION FORM SUBMISSION & DYNAMIC VIETQR GENERATOR
    const regForm = document.getElementById('english-reg-form');
    const formContainer = document.getElementById('form-container');
    const paymentContainer = document.getElementById('payment-container');
    const paymentQr = document.getElementById('payment-qr');
    const transferContentText = document.getElementById('transfer-content');
    const btnBackToForm = document.getElementById('btn-back-to-form');

    if (regForm && formContainer && paymentContainer) {
        regForm.addEventListener('submit', (e) => {
            e.preventDefault();

            // Collect form fields
            const name = document.getElementById('user-name').value.trim();
            const age = document.getElementById('user-age').value.trim();
            const email = document.getElementById('user-email').value.trim();
            const phone = document.getElementById('user-phone').value.trim().replace(/\s+/g, '');
            const fb = document.getElementById('user-fb').value.trim();
            const goal = document.getElementById('user-goal').value.trim();
            const history = document.getElementById('user-history').value.trim();

            // Collect sources
            const checkedSources = [];
            const checkboxes = document.querySelectorAll('input[name="source"]:checked');
            checkboxes.forEach(cb => {
                if (cb.value === 'khac') {
                    checkedSources.push(`Nguồn khác: ${otherSourceText.value.trim()}`);
                } else {
                    checkedSources.push(cb.value);
                }
            });

            // Form validation for checkboxes (ensure at least one source is checked)
            if (checkedSources.length === 0) {
                alert('Vui lòng chọn ít nhất một kênh bạn biết đến thử thách!');
                return;
            }

            // Create transfer description syntax (e.g. TA 0987654321)
            const transferMemo = `TA ${phone}`.toUpperCase();

            // Generate dynamic VietQR image URL using open API
            // format: https://img.vietqr.io/image/<BANK_ID>-<ACCOUNT_NO>-<TEMPLATE>.png?amount=<AMOUNT>&addInfo=<TEXT>&accountName=<NAME>
            const bankId = 'MB'; // MB Bank
            const accountNo = '0934619998';
            const accountName = encodeURIComponent('VU BAO TRUNG');
            const amount = 249000;
            const encodedMemo = encodeURIComponent(transferMemo);
            
            const vietQrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${amount}&addInfo=${encodedMemo}&accountName=${accountName}`;

            // Update UI elements on payment screen
            paymentQr.src = vietQrUrl;
            transferContentText.textContent = transferMemo;

            // Log submission (simulating a database capture / backend api call)
            const submissionData = {
                name,
                age,
                email,
                phone,
                fb,
                sources: checkedSources,
                goal,
                history,
                paymentMemo: transferMemo,
                timestamp: new Date().toISOString()
            };
            
            // Save to localStorage for client-side storage simulation
            let submissions = JSON.parse(localStorage.getItem('english_challenge_submissions') || '[]');
            submissions.push(submissionData);
            localStorage.setItem('english_challenge_submissions', JSON.stringify(submissions));

            console.log('Submission saved successfully:', submissionData);

            // Switch screen with fade-in effect
            formContainer.style.display = 'none';
            paymentContainer.style.display = 'flex';

            // Scroll to form section top smoothly
            document.getElementById('register').scrollIntoView({ behavior: 'smooth' });
        });

        // 5. BACK TO FORM BUTTON
        if (btnBackToForm) {
            btnBackToForm.addEventListener('click', () => {
                // Reset form values
                regForm.reset();
                if (otherSourceText) {
                    otherSourceText.style.display = 'none';
                    otherSourceText.required = false;
                }
                
                // Show form, hide payment instructions
                paymentContainer.style.display = 'none';
                formContainer.style.display = 'block';
                
                // Scroll back
                document.getElementById('register').scrollIntoView({ behavior: 'smooth' });
            });
        }
    }

    // 6. SCROLL REVEAL ANIMATION
    const revealElements = document.querySelectorAll('.reveal');
    const observerOptions = {
        root: null,
        threshold: 0.1, // Trigger when 10% of element is visible
        rootMargin: '0px'
    };

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target); // Reveal only once
            }
        });
    }, observerOptions);

    revealElements.forEach(el => {
        revealObserver.observe(el);
    });
});
