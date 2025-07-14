// API Configuration - API calls will be made through the backend
// IMPORTANT: This is your actual Render backend URL
const API_URL = 'https://linkedin-post-generator-backend-dxes.onrender.com/api/generate-post';

// DOM Elements
const postForm = document.getElementById('postForm');
const resultCard = document.getElementById('resultCard');
const generatedPost = document.getElementById('generatedPost');
const loadingSpinner = document.getElementById('loadingSpinner');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');

// Event Listeners
postForm.addEventListener('submit', handleFormSubmit);

// URL detection regex - improved to handle more URL formats
const URL_REGEX = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?(\?[^\s]*)?$/;

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const topic = document.getElementById('topic').value.trim();
    const industry = document.getElementById('industry').value;
    const tone = document.getElementById('tone').value;
    const model = document.getElementById('model').value;
    const wordCount = parseInt(document.getElementById('wordCount').value, 10);
    
    // Show loading spinner
    showLoading();
    hideError();
    hideResult();
    
    try {
        let post;
        
        // Check if topic is a URL
        if (isValidURL(topic)) {
            post = await generateLinkedInPostFromArticle(topic, industry, tone, model, wordCount);
        } else {
            post = await generateLinkedInPost(topic, industry, tone, model, wordCount);
        }
        
        displayResult(post);
    } catch (error) {
        console.error('Error details:', error);
        let errorMessage = 'Failed to generate post. ';
        
        if (error.message.includes('Failed to fetch')) {
            errorMessage += 'Please make sure the Python server is running on port 8000.';
        } else if (error.message.includes('Server error: 500')) {
            errorMessage += 'Server error - please check if the OpenRouter API key is configured.';
        } else if (error.message.includes('Server error: 429')) {
            errorMessage += 'Rate limit exceeded. Please try again in a few minutes.';
        } else {
            errorMessage += error.message;
        }
        
        showError(errorMessage);
    } finally {
        hideLoading();
    }
}

// Check if input is a valid URL
function isValidURL(string) {
    return URL_REGEX.test(string);
}

// Extract article content from URL
async function extractArticleContent(url) {
    try {
        // Use a CORS proxy to fetch the article content
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if (data.contents) {
            // Parse the HTML content
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');
            
            // Extract text content from common article selectors
            const selectors = [
                'article',
                '[class*="content"]',
                '[class*="article"]',
                '[class*="post"]',
                '.post-content',
                '.article-content',
                '.entry-content',
                'main',
                '.main-content'
            ];
            
            let content = '';
            for (const selector of selectors) {
                const element = doc.querySelector(selector);
                if (element) {
                    content = element.textContent.trim();
                    if (content.length > 100) break;
                }
            }
            
            // If no specific content found, get body text
            if (!content || content.length < 100) {
                content = doc.body.textContent.trim();
            }
            
            // Clean up the content
            content = content.replace(/\s+/g, ' ').substring(0, 2000);
            
            return {
                title: doc.title || 'Article',
                content: content,
                url: url
            };
        }
        
        throw new Error('Could not extract content from URL');
    } catch (error) {
        console.error('Error extracting article content:', error);
        throw new Error('Failed to extract article content. Please check the URL and try again.');
    }
}

// Generate LinkedIn post from article URL using backend API
async function generateLinkedInPostFromArticle(url, industry, tone, model, wordCount) {
    console.log('Making article API call to:', API_URL);
    
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            type: 'article',
            url: url,
            industry: industry,
            tone: tone,
            model: model,
            word_count: wordCount
        })
    });
    
    console.log('Article response status:', response.status);
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error('Article error response:', errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Article response data:', data);
    return data.post;
}

// Generate LinkedIn post using backend API
async function generateLinkedInPost(topic, industry, tone, model, wordCount) {
    console.log('Making API call to:', API_URL);
    
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            type: 'topic',
            topic: topic,
            industry: industry,
            tone: tone,
            model: model,
            word_count: wordCount
        })
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Response data:', data);
    return data.post;
}

// Display generated result
function displayResult(post) {
    generatedPost.textContent = post;
    resultCard.style.display = 'block';
    
    // Scroll to result
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Copy post to clipboard
async function copyToClipboard() {
    const postText = generatedPost.textContent;
    
    try {
        await navigator.clipboard.writeText(postText);
        showCopySuccess();
    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = postText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showCopySuccess();
    }
}

// Show copy success message
function showCopySuccess() {
    const successDiv = document.createElement('div');
    successDiv.className = 'copy-success';
    successDiv.innerHTML = '<i class="fas fa-check"></i> Post copied to clipboard!';
    
    const postPreview = document.querySelector('.post-preview');
    postPreview.appendChild(successDiv);
    
    // Remove success message after 3 seconds
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.parentNode.removeChild(successDiv);
        }
    }, 3000);
}

// Open LinkedIn feed page directly
function openLinkedIn() {
    // Open LinkedIn's main feed page
    window.open('https://www.linkedin.com/feed/', '_blank');
}

// Show notification
function showNotification(message, type = 'info') {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Style the notification
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#d4edda' : '#d1ecf1'};
        color: ${type === 'success' ? '#155724' : '#0c5460'};
        border: 1px solid ${type === 'success' ? '#c3e6cb' : '#bee5eb'};
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }, 3000);
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Generate new post
function generateNew() {
    hideResult();
    hideError();
    document.getElementById('topic').focus();
}

// Utility functions for showing/hiding elements
function showLoading() {
    loadingSpinner.style.display = 'block';
}

function hideLoading() {
    loadingSpinner.style.display = 'none';
}

function showError(message) {
    errorText.textContent = message;
    errorMessage.style.display = 'flex';
}

function hideError() {
    errorMessage.style.display = 'none';
}

function hideResult() {
    resultCard.style.display = 'none';
}

// Add some interactive features
document.addEventListener('DOMContentLoaded', function() {
    // Add focus effects to form inputs
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.style.transform = 'scale(1.02)';
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.style.transform = 'scale(1)';
        });
    });
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + Enter to generate post
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            postForm.dispatchEvent(new Event('submit'));
        }
        
        // Escape to clear form
        if (e.key === 'Escape') {
            postForm.reset();
            hideResult();
            hideError();
        }
    });
    
    // Add sample topics and URL detection
    const topicInput = document.getElementById('topic');
    const sampleTopics = [
        'web development project completion',
        'client success story',
        'industry insights and tips',
        'professional achievement',
        'team collaboration success',
        'technology innovation',
        'business growth strategies',
        'remote work productivity'
    ];
    
    const sampleUrls = [
        'https://example.com/article-about-ai',
        'https://techcrunch.com/2024/01/15/ai-trends',
        'https://hbr.org/2024/01/leadership-insights'
    ];
    
    topicInput.addEventListener('click', function() {
        if (!this.value) {
            const randomChoice = Math.random() > 0.7 ? sampleUrls : sampleTopics;
            this.placeholder = randomChoice[Math.floor(Math.random() * randomChoice.length)];
        }
    });
    
    // Add URL detection indicator
    topicInput.addEventListener('input', function() {
        const isUrl = isValidURL(this.value);
        const formGroup = this.parentElement;
        
        // Remove existing indicator
        const existingIndicator = formGroup.querySelector('.url-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        if (isUrl && this.value.trim()) {
            const indicator = document.createElement('div');
            indicator.className = 'url-indicator';
            indicator.innerHTML = '<i class="fas fa-link"></i> Article detected - will summarize content';
            indicator.style.color = '#0077b5';
            indicator.style.fontSize = '0.8rem';
            indicator.style.marginTop = '5px';
            indicator.style.fontWeight = '500';
            formGroup.appendChild(indicator);
        }
    });
});

// Add smooth scrolling for better UX
function smoothScrollTo(element) {
    element.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

// Add loading animation for better user experience
function addLoadingAnimation() {
    const generateBtn = document.querySelector('.generate-btn');
    const originalText = generateBtn.innerHTML;
    
    generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    generateBtn.disabled = true;
    
    return () => {
        generateBtn.innerHTML = originalText;
        generateBtn.disabled = false;
    };
}

// Enhanced error handling with retry functionality
function showErrorWithRetry(message) {
    showError(message);
    
    const retryBtn = document.createElement('button');
    retryBtn.textContent = 'Retry';
    retryBtn.className = 'action-btn copy-btn';
    retryBtn.style.marginTop = '10px';
    retryBtn.onclick = () => {
        hideError();
        postForm.dispatchEvent(new Event('submit'));
    };
    
    errorMessage.appendChild(retryBtn);
}

// Add character count for topic input
function addCharacterCount() {
    const topicInput = document.getElementById('topic');
    const charCount = document.createElement('div');
    charCount.className = 'char-count';
    charCount.style.fontSize = '0.8rem';
    charCount.style.color = '#666';
    charCount.style.textAlign = 'right';
    charCount.style.marginTop = '5px';
    
    topicInput.parentElement.appendChild(charCount);
    
    topicInput.addEventListener('input', function() {
        const count = this.value.length;
        const max = 500; // Increased for URLs
        charCount.textContent = `${count}/${max}`;
        
        if (count > max) {
            charCount.style.color = '#dc3545';
        } else {
            charCount.style.color = '#666';
        }
    });
}

// Initialize character count
document.addEventListener('DOMContentLoaded', addCharacterCount); 