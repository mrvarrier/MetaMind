// Simple JavaScript for the landing page
document.addEventListener('DOMContentLoaded', function() {
    // Smooth scrolling for navigation links
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                const navHeight = document.querySelector('.navbar').offsetHeight;
                const targetPosition = targetElement.offsetTop - navHeight - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Navbar scroll effect
    const navbar = document.getElementById('navbar');
    
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
    
    // Mobile menu toggle
    const mobileToggle = document.getElementById('mobile-menu-toggle');
    const navMenu = document.getElementById('nav-menu');
    
    if (mobileToggle && navMenu) {
        mobileToggle.addEventListener('click', function() {
            navMenu.classList.toggle('mobile-open');
            mobileToggle.classList.toggle('active');
        });
    }
    
    // Typing animation for the search demo
    const typingElement = document.getElementById('typing-text');
    if (typingElement) {
        const texts = [
            'Find all photos from last vacation...',
            'Show me project documents from 2024...',
            'Search for presentations about AI...',
            'Find large video files...'
        ];
        
        let currentIndex = 0;
        let currentChar = 0;
        let isDeleting = false;
        
        function typeText() {
            const currentText = texts[currentIndex];
            
            if (isDeleting) {
                typingElement.textContent = currentText.substring(0, currentChar - 1);
                currentChar--;
            } else {
                typingElement.textContent = currentText.substring(0, currentChar + 1);
                currentChar++;
            }
            
            let typeSpeed = isDeleting ? 50 : 100;
            
            if (!isDeleting && currentChar === currentText.length) {
                typeSpeed = 2000;
                isDeleting = true;
            } else if (isDeleting && currentChar === 0) {
                isDeleting = false;
                currentIndex = (currentIndex + 1) % texts.length;
            }
            
            setTimeout(typeText, typeSpeed);
        }
        
        typeText();
    }
});