// js/blogManager.js

// Firebase Configuration (REPLACE WITH YOUR ACTUAL API KEY AND PROJECT DETAILS)
const firebaseConfig = {
    apiKey: "AIzaSyBf5-lQmRvILKxXdTFIHthQPhMGTo_oSxo", // Your actual API Key
    authDomain: "shieldoffaithdemo.firebaseapp.com",
    projectId: "shieldoffaithdemo",
    storageBucket: "shieldoffaithdemo.firebasestorage.app",
    messagingSenderId: "353881791273",
    appId: "1:353881791273:web:4a74f00bc0fa8f190c7538",
    measurementId: "G-7X1S6JZG61"
};

// Initialize Firebase (using specific CDN URLs for v9)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getFirestore, collection, getDocs, query, orderBy, doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

class BlogManager {
    constructor() {
        this.blogPosts = [];
        this.blogContainer = document.getElementById('blog-posts-container');
        this.loadingMessage = document.getElementById('loading-message');

        // References to modal elements
        this.modalTitle = document.getElementById('blogDetailModalLabel');
        this.modalBlogImage = document.getElementById('modalBlogImage');
        this.modalBlogAuthor = document.getElementById('modalBlogAuthor');
        this.modalBlogDate = document.getElementById('modalBlogDate');
        this.modalBlogCategory = document.getElementById('modalBlogCategory');
        this.modalBlogContent = document.getElementById('modalBlogContent');

        // Define the default placeholder image URL for both cards and modal
        this.defaultPlaceholderImage = 'https://placehold.co/800x500/2563eb/ffffff?text=shield of faith';
        this.modalPlaceholderImage = 'https://placehold.co/800x500/2563eb/ffffff?text=shield of faith'; // A larger placeholder for modal

        this.init();
    }

    async init() {
        console.log("Initializing Blog Manager...");
        if (this.loadingMessage) {
            this.loadingMessage.style.display = 'block'; // Show loading message
        }
        await this.loadBlogPosts();
        this.renderBlogPosts();
        if (this.loadingMessage) {
            this.loadingMessage.style.display = 'none'; // Hide loading message
        }
    }

    async loadBlogPosts() {
        try {
            console.log("Attempting to load blog posts from Firestore...");
            // Query the 'blogPosts' collection, ordered by 'date' descending
            const blogsQuery = query(collection(db, 'blogPosts'), orderBy('date', 'desc'));
            const querySnapshot = await getDocs(blogsQuery);
            this.blogPosts = []; // Clear array before populating

            querySnapshot.forEach((doc) => {
                this.blogPosts.push({ id: doc.id, ...doc.data() });
            });
            console.log("Successfully fetched blog posts:", this.blogPosts);

        } catch (error) {
            console.error('Error loading blog posts from Firestore:', error);
            if (this.blogContainer) {
                this.blogContainer.innerHTML = '<div class="col-12 text-center text-danger empty-state-message"><i class="fas fa-exclamation-triangle me-2"></i> Failed to load blog posts. Please check your internet connection or try again later.</div>';
            }
        }
    }

    renderBlogPosts() {
        if (!this.blogContainer) {
            console.error("Target container for blog posts (ID 'blog-posts-container') not found.");
            return;
        }

        this.blogContainer.innerHTML = ''; // Clear existing content (like loading message)

        if (this.blogPosts.length === 0) {
            this.blogContainer.innerHTML = '<div class="col-12 text-center text-muted empty-state-message"><i class="fas fa-box-open fa-2x d-block mb-2"></i> No blog posts available at the moment. Check back soon!</div>';
            return;
        }

        this.blogPosts.forEach(post => {
            const postElement = this.createBlogPostElement(post);
            this.blogContainer.appendChild(postElement);
        });
        console.log(`Rendered ${this.blogPosts.length} blog posts.`);
    }

    createBlogPostElement(post) {
        const col = document.createElement('div');
        col.className = 'col';

        let publishDateFormatted = 'No Date';
        if (post.date && typeof post.date === 'object' && typeof post.date.seconds === 'number') {
            publishDateFormatted = new Date(post.date.seconds * 1000).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
        }

        const initialImageUrl = post.imageUrl || this.defaultPlaceholderImage;

        col.innerHTML = `
            <div class="blog-card h-100">
                <img src="${initialImageUrl}"
                     alt="${post.title || 'Blog Post Image'}"
                     class="blog-card-img-top"
                     onerror="this.src='${this.defaultPlaceholderImage}'; this.onerror=null;">
                <div class="card-body">
                    <h5 class="card-title">${post.title || 'Untitled Blog Post'}</h5>
                    <div class="card-meta">
                        <span><i class="fas fa-user me-1"></i> ${post.author || 'Unknown'}</span>
                        <span class="ms-3"><i class="far fa-calendar-alt me-1"></i> ${publishDateFormatted}</span>
                        ${post.category ? `<span class="ms-3"><i class="fas fa-tag me-1"></i> ${post.category}</span>` : ''}
                    </div>
                    <p class="card-text">${post.excerpt || (post.content ? post.content.substring(0, 150) + '...' : 'No description available.')}</p>
                    <button type="button" class="btn btn-primary-custom"
                            data-bs-toggle="modal" data-bs-target="#blogDetailModal"
                            data-post-id="${post.id}">
                        Read More
                    </button>
                </div>
            </div>
        `;

        const readMoreButton = col.querySelector('.btn-primary-custom');
        if (readMoreButton) {
            readMoreButton.addEventListener('click', (event) => {
                const postId = event.target.dataset.postId;
                this.showBlogPostDetail(postId);
            });
        }

        return col;
    }

   async showBlogPostDetail(postId) {
    console.log("Fetching full content for post ID:", postId);

    // Show loading state
    if (this.modalTitle) this.modalTitle.textContent = 'Loading...';
    if (this.modalBlogContent) {
        this.modalBlogContent.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin me-2"></i>Loading content...</div>';
    }
    if (this.modalBlogImage) this.modalBlogImage.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='; // Transparent pixel

    try {
        const docRef = doc(db, 'blogPosts', postId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const post = docSnap.data();
            console.log("Full post data fetched:", post);

            // Update modal title
            if (this.modalTitle) this.modalTitle.textContent = post.title || 'Untitled Blog Post';

            // Update modal image
            if (this.modalBlogImage) {
                this.modalBlogImage.src = post.imageUrl || this.modalPlaceholderImage;
                this.modalBlogImage.alt = post.title || 'Blog Post Image';
                this.modalBlogImage.onerror = () => {
                    this.modalBlogImage.onerror = null;
                    this.modalBlogImage.src = this.modalPlaceholderImage;
                };
            }

            // Update author
            if (this.modalBlogAuthor) {
                this.modalBlogAuthor.innerHTML = `<i class="fas fa-user me-1"></i> ${post.author || 'Unknown'}`;
            }

            // Update date
            let fullPublishDateFormatted = 'No Date';
            if (post.date && typeof post.date === 'object' && typeof post.date.seconds === 'number') {
                fullPublishDateFormatted = new Date(post.date.seconds * 1000).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });
            }
            if (this.modalBlogDate) {
                this.modalBlogDate.innerHTML = `<i class="far fa-calendar-alt me-1"></i> ${fullPublishDateFormatted}`;
            }

            // Update category
            if (this.modalBlogCategory) {
                this.modalBlogCategory.innerHTML = post.category ? `<i class="fas fa-tag me-1"></i> ${post.category}` : '';
            }

            // Update content - THIS IS THE MAIN FIX
            if (this.modalBlogContent) {
                // Clear any existing content and add the blog-content class
                this.modalBlogContent.innerHTML = '';
                this.modalBlogContent.classList.add('blog-content');
                
                // Set the content
                const content = post.content || 'No detailed content available for this post.';
                this.modalBlogContent.innerHTML = content;
                
                console.log("Modal content updated with:", content);
            }

        } else {
            console.error("No such document found for ID:", postId);
            if (this.modalTitle) this.modalTitle.textContent = "Error";
            if (this.modalBlogContent) {
                this.modalBlogContent.innerHTML = "<p class='text-center text-danger'>Sorry, the full content for this post could not be found.</p>";
            }
        }
    } catch (error) {
        console.error("Error fetching single blog post:", error);
        if (this.modalTitle) this.modalTitle.textContent = "Error";
        if (this.modalBlogContent) {
            this.modalBlogContent.innerHTML = `<p class='text-center text-danger'>Failed to load full blog post: ${error.message}.</p>`;
        }
    }
}
}

document.addEventListener('DOMContentLoaded', () => {
    new BlogManager();
});