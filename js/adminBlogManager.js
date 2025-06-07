// js/adminBlogManager.js

// Firebase Configuration (Make sure this matches your Firebase project credentials)
const firebaseConfig = {
    apiKey: "AIzaSyBf5-lQmRvILKxXdTFIHthQPhMGTo_oSxo",
    authDomain: "shieldoffaithdemo.firebaseapp.com",
    projectId: "shieldoffaithdemo",
    storageBucket: "shieldoffaithdemo.firebasestorage.app",
    messagingSenderId: "353881791273",
    appId: "1:353881791273:web:4a74f00bc0fa8f190c7538",
    measurementId: "G-7X1S6JZG61"
};

// Firebase SDK Imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { // Firestore imports
    getFirestore,
    collection,
    addDoc,
    doc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    onSnapshot, // For real-time updates
    Timestamp // For handling date types
} from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { // Firebase Auth imports - <<< ADDED THESE LINES >>>
    getAuth,
    onAuthStateChanged,
    signOut
} from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';


// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); // <<< INITIALIZE FIREBASE AUTH >>>

// --- DOM Elements ---
const logoutBtn = document.getElementById('logoutBtn');

const blogPostForm = document.getElementById('blogPostForm');
const formTitle = document.getElementById('formTitle');
const blogPostIdInput = document.getElementById('blogPostId');
const blogTitleInput = document.getElementById('blogTitle');
const blogAuthorInput = document.getElementById('blogAuthor');
const blogCategoryInput = document.getElementById('blogCategory');
const blogImageUrlInput = document.getElementById('blogImageUrl');
const blogExcerptInput = document.getElementById('blogExcerpt');
const blogContentInput = document.getElementById('blogContent');
const saveBlogPostBtn = document.getElementById('saveBlogPostBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const formMessage = document.getElementById('formMessage');

const adminBlogPostsGrid = document.getElementById('adminBlogPostsGrid');
const loadingMessage = document.getElementById('loadingMessage');
const noBlogPostsMessage = document.getElementById('noBlogPostsMessage');

const confirmModal = document.getElementById('confirmModal');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

let currentEditingBlogPostId = null; // Stores the ID of the blog post being edited/deleted
let unsubscribeSnapshot = null; // To store the unsubscribe function for real-time listener

// --- Utility Functions ---

/**
 * Displays a message in the form area.
 * @param {string} message - The message to display.
 * @param {boolean} isError - True if it's an error message, false for success/info.
 */
function showFormMessage(message, isError = false) {
    formMessage.textContent = message;
    formMessage.classList.remove('hidden', 'text-red-600', 'text-green-600');
    formMessage.classList.add(isError ? 'text-red-600' : 'text-green-600');
    formMessage.classList.remove('hidden');
    setTimeout(() => {
        formMessage.classList.add('hidden');
    }, 5000); // Hide after 5 seconds
}

/**
 * Resets the blog post form to its 'add new blog post' state.
 */
function resetForm() {
    blogPostForm.reset();
    blogPostIdInput.value = '';
    formTitle.textContent = 'Add New Blog Post';
    saveBlogPostBtn.textContent = 'Add Blog Post';
    cancelEditBtn.classList.add('hidden');
    currentEditingBlogPostId = null;
    showFormMessage('', false); // Clear any existing messages
}

/**
 * Populates the form with blog post data for editing.
 * @param {Object} blogPost - The blog post data object.
 */
function populateFormForEdit(blogPost) {
    blogPostIdInput.value = blogPost.id;
    blogTitleInput.value = blogPost.title || '';
    blogAuthorInput.value = blogPost.author || '';
    blogCategoryInput.value = blogPost.category || '';
    blogImageUrlInput.value = blogPost.imageUrl || '';
    blogExcerptInput.value = blogPost.excerpt || '';
    blogContentInput.value = blogPost.content || '';

    formTitle.textContent = 'Edit Blog Post';
    saveBlogPostBtn.textContent = 'Update Blog Post';
    cancelEditBtn.classList.remove('hidden');
    currentEditingBlogPostId = blogPost.id; // Set the current editing ID
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top to see the form
}

// --- Logout ---

/**
 * Handles logout.
 */
logoutBtn.addEventListener('click', async () => { // <<< ADDED 'async' >>>
    try {
        if (unsubscribeSnapshot) {
            unsubscribeSnapshot(); // Unsubscribe from Firestore listener
            unsubscribeSnapshot = null;
        }
        await signOut(auth); // <<< PERFORM FIREBASE AUTH SIGNOUT >>>
        localStorage.removeItem('adminLoggedIn'); // Clear client-side flag
        window.location.href = 'admin_login.html'; // Redirect to the login page
    } catch (error) {
        console.error("Error signing out:", error);
        showFormMessage(`Logout failed: ${error.message}`, true); // Display error
    }
});


// --- Firestore CRUD Operations ---

/**
 * Submits the blog post form (add or update).
 */
blogPostForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // <<< IMPORTANT: Check for authenticated user BEFORE attempting CRUD operations >>>
    if (!auth.currentUser) {
        showFormMessage('You are not authenticated. Please log in again.', true);
        console.warn("Attempted CRUD operation without authenticated user.");
        // Optionally redirect to login immediately:
        // window.location.href = 'admin_login.html';
        return;
    }

    const title = blogTitleInput.value.trim();
    const author = blogAuthorInput.value.trim();
    const category = blogCategoryInput.value.trim();
    const imageUrl = blogImageUrlInput.value.trim();
    const excerpt = blogExcerptInput.value.trim();
    const content = blogContentInput.value.trim();

    if (!title || !author || !content) {
        showFormMessage('Title, Author, and Full Content are required.', true);
        return;
    }

    const blogPostData = {
        title,
        author,
        category: category || 'General',
        imageUrl: imageUrl || '', // Allow empty for placeholder
        excerpt: excerpt || content.substring(0, 150) + '...', // Auto-generate excerpt if empty
        content,
        date: Timestamp.fromDate(new Date()) // Always set current date on creation/update
    };

    try {
        if (currentEditingBlogPostId) {
            // Update existing blog post
            const blogPostRef = doc(db, 'blogPosts', currentEditingBlogPostId);
            await updateDoc(blogPostRef, blogPostData);
            showFormMessage('Blog post updated successfully!', false);
        } else {
            // Add new blog post
            await addDoc(collection(db, 'blogPosts'), blogPostData);
            showFormMessage('Blog post added successfully!', false);
        }
        resetForm(); // Clear form after success
    } catch (error) {
        // More specific error handling for Firestore permissions
        if (error.code === 'permission-denied') {
            showFormMessage('Permission denied. Please ensure you are logged in with administrative privileges.', true);
        } else {
            showFormMessage(`Error saving blog post: ${error.message}`, true);
        }
        console.error("Error saving blog post:", error);
    }
});

// Cancel Edit button handler
cancelEditBtn.addEventListener('click', resetForm);

/**
 * Handles deleting a blog post.
 * @param {string} blogPostId - The ID of the blog post to delete.
 */
async function deleteBlogPost(blogPostId) {
    // <<< IMPORTANT: Check for authenticated user BEFORE attempting CRUD operations >>>
    if (!auth.currentUser) {
        showFormMessage('You are not authenticated. Please log in again.', true);
        console.warn("Attempted delete operation without authenticated user.");
        hideConfirmModal(); // Hide modal even if not authenticated
        // Optionally redirect to login immediately:
        // window.location.href = 'admin_login.html';
        return;
    }

    try {
        const blogPostRef = doc(db, 'blogPosts', blogPostId);
        await deleteDoc(blogPostRef);
        showFormMessage('Blog post deleted successfully!', false);
        resetForm(); // Clear form if the deleted post was being edited
    } catch (error) {
        if (error.code === 'permission-denied') {
            showFormMessage('Permission denied. Please ensure you are logged in with administrative privileges.', true);
        } else {
            showFormMessage(`Error deleting blog post: ${error.message}`, true);
        }
        console.error("Error deleting blog post:", error);
    } finally {
        hideConfirmModal(); // Always hide the modal
    }
}

// --- Display Blog Posts in Admin Panel (Real-time with onSnapshot) ---

/**
 * Creates an HTML card for a blog post, including edit/delete buttons.
 * (This function does not need changes related to auth)
 */
function createAdminBlogPostCard(blogPost) {
    let publishDate;
    if (blogPost.date && typeof blogPost.date.toDate === 'function') {
        publishDate = blogPost.date.toDate();
    } else if (blogPost.date && typeof blogPost.date.seconds === 'number') {
        publishDate = new Date(blogPost.date.seconds * 1000);
    } else {
        console.warn("Blog post has invalid date format, cannot display:", blogPost);
        const errorCard = document.createElement('div');
        errorCard.className = 'col blog-item bg-red-100 text-red-700 p-4 rounded-lg';
        errorCard.innerHTML = `<p>Error: Invalid date for blog post ID: ${blogPost.id || 'N/A'}</p>`;
        return errorCard;
    }

    const col = document.createElement('div');
    col.className = 'col'; // Tailwind grid column for responsiveness
    col.setAttribute('data-blog-post-id', blogPost.id);

    const defaultCardImage = 'https://placehold.co/600x400/2563eb/ffffff?text=✝';
    const initialImageUrl = blogPost.imageUrl || defaultCardImage;

    col.innerHTML = `
        <div class="blog-card h-full flex flex-col">
            <div class="image-wrapper relative overflow-hidden rounded-t-lg">
                <img src="${initialImageUrl}"
                     alt="${blogPost.title || 'Blog Post Image'}"
                     class="blog-card-img-top w-full h-48 object-cover transition-transform duration-300 ease-in-out hover:scale-105"
                     onerror="this.src='${defaultCardImage}'; this.onerror=null;">
                </div>
            <div class="blog-card-body p-4 flex-grow">
                <h3 class="blog-title text-xl font-semibold mb-2">${blogPost.title || 'Untitled Blog Post'}</h3>
                <div class="blog-meta text-sm text-gray-600 mb-2">
                    <span class="mr-3"><i class="fas fa-user mr-1"></i> ${blogPost.author || 'Unknown'}</span>
                    <span class="mr-3"><i class="far fa-calendar-alt mr-1"></i> ${publishDate.toLocaleDateString()}</span>
                    ${blogPost.category ? `<span><i class="fas fa-tag mr-1"></i> ${blogPost.category}</span>` : ''}
                </div>
                <p class="blog-excerpt text-gray-700 mb-4 blog-content">${blogPost.excerpt || (blogPost.content ? blogPost.content.substring(0, 150) + '...' : 'No description available.')}</p>
              </div>
            <div class="admin-blog-actions">
                <button class="btn-warning edit-btn px-4 py-2 rounded-lg" data-id="${blogPost.id}">
                    <i class="fas fa-edit mr-2"></i>Edit
                </button>
                <button class="btn-danger delete-btn px-4 py-2 rounded-lg" data-id="${blogPost.id}">
                    <i class="fas fa-trash-alt mr-2"></i>Delete
                </button>
            </div>
        </div>
    `;

    // Add event listeners for edit and delete buttons
    col.querySelector('.edit-btn').addEventListener('click', () => {
        populateFormForEdit(blogPost);
    });

    col.querySelector('.delete-btn').addEventListener('click', () => {
        currentEditingBlogPostId = blogPost.id; // Store ID for deletion
        showConfirmModal(blogPost.title); // Pass title for confirmation message
    });

    return col;
}


/**
 * Fetches and displays blog posts in real-time.
 */
// <<< MODIFIED: Wrapped with onAuthStateChanged >>>
function loadAndDisplayBlogPosts() {
    // Show loading message
    loadingMessage.classList.remove('hidden');
    noBlogPostsMessage.classList.add('hidden'); // Hide no blog posts message initially
    adminBlogPostsGrid.innerHTML = ''; // Clear existing blog posts

    // Unsubscribe from previous snapshot listener if it exists
    if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
    }

    const blogPostsRef = collection(db, 'blogPosts');
    const q = query(blogPostsRef, orderBy('date', 'desc')); // Order by date, latest first

    // onSnapshot listener will now be established ONLY if authenticated
    unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const blogPosts = [];
        snapshot.forEach((doc) => {
            blogPosts.push({ id: doc.id, ...doc.data() });
        });

        adminBlogPostsGrid.innerHTML = ''; // Clear grid before re-rendering

        if (blogPosts.length === 0) {
            noBlogPostsMessage.classList.remove('hidden');
            loadingMessage.classList.add('hidden');
        } else {
            noBlogPostsMessage.classList.add('hidden');
            loadingMessage.classList.add('hidden');
            blogPosts.forEach(blogPost => {
                const blogPostCard = createAdminBlogPostCard(blogPost);
                adminBlogPostsGrid.appendChild(blogPostCard);
            });
        }
    }, (error) => {
        console.error("Error fetching real-time blog posts:", error);
        loadingMessage.classList.add('hidden');
        noBlogPostsMessage.classList.remove('hidden'); // Show message in case of error
        // More specific error handling
        if (error.code === 'permission-denied') {
             noBlogPostsMessage.textContent = 'You do not have permission to view this data. Please log in.';
             // If this happens often, consider redirecting to login.
             // window.location.href = 'admin_login.html';
        } else {
            noBlogPostsMessage.textContent = `Error loading blog posts: ${error.message}`;
        }
    });
}

// --- Confirmation Modal Logic ---

/**
 * Shows the confirmation modal.
 */
function showConfirmModal(blogPostTitle) {
    confirmModal.querySelector('p').textContent = `Are you sure you want to delete "${blogPostTitle}"? This action cannot be undone.`;
    confirmModal.classList.add('show');
}

/**
 * Hides the confirmation modal.
 */
function hideConfirmModal() {
    confirmModal.classList.remove('show');
    currentEditingBlogPostId = null; // Clear ID after action or cancellation
}

confirmDeleteBtn.addEventListener('click', () => {
    if (currentEditingBlogPostId) {
        deleteBlogPost(currentEditingBlogPostId);
    }
});

cancelDeleteBtn.addEventListener('click', hideConfirmModal);

// Hide modal if clicked outside (optional, but good UX)
confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
        hideConfirmModal();
    }
});

// <<< IMPORTANT: Modified initial load to depend on Firebase Auth state >>>
// This ensures that the page only attempts to load/display blog posts
// (and thus trigger Firestore read rules) once a user is known to be authenticated.
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("Admin page: User authenticated:", user.email);
            // User is signed in, proceed to load data and set up listeners
            localStorage.setItem('adminLoggedIn', 'true'); // Keep client-side flag consistent
            loadAndDisplayBlogPosts(); // Now safe to load blog posts
        } else {
            console.log("Admin page: No user authenticated. Redirecting to login.");
            localStorage.removeItem('adminLoggedIn'); // Ensure client-side flag is cleared
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot(); // Stop listening if user logs out unexpectedly
                unsubscribeSnapshot = null;
            }
            window.location.href = 'admin_login.html'; // Redirect to login page
        }
    });
});

// Mobile menu toggle
document.getElementById('mobileMenuToggle')?.addEventListener('click', () => {
    const navLinks = document.getElementById('navLinks');
    navLinks.classList.toggle('show');
});