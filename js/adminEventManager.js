
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

    const eventForm = document.getElementById('eventForm');
    const formTitle = document.getElementById('formTitle');
    const eventIdInput = document.getElementById('eventId');
    const eventTitleInput = document.getElementById('eventTitle');
    const eventLocationInput = document.getElementById('eventLocation');
    const eventDateInput = document.getElementById('eventDate');
    const eventImageUrlInput = document.getElementById('eventImageUrl');
    const eventAgeGroupInput = document.getElementById('eventAgeGroup');
    const eventAgeGroupDisplayInput = document.getElementById('eventAgeGroupDisplay');
    const eventRegistrationUrlInput = document.getElementById('eventRegistrationUrl');
    const eventQuoteInput = document.getElementById('eventQuote');
    const eventDescriptionInput = document.getElementById('eventDescription');
    const saveEventBtn = document.getElementById('saveEventBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const formMessage = document.getElementById('formMessage');

    const adminEventsGrid = document.getElementById('adminEventsGrid');
    const loadingMessage = document.getElementById('loadingMessage');
    const noEventsMessage = document.getElementById('noEventsMessage');

    const confirmModal = document.getElementById('confirmModal');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

    let currentEditingEventId = null; // Stores the ID of the event being edited/deleted
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
     * Resets the event form to its 'add new event' state.
     */
    function resetForm() {
        eventForm.reset();
        eventIdInput.value = '';
        formTitle.textContent = 'Add New Event';
        saveEventBtn.textContent = 'Add Event';
        cancelEditBtn.classList.add('hidden');
        currentEditingEventId = null;
        showFormMessage('', false); // Clear any existing messages
    }

    /**
     * Populates the form with event data for editing.
     * @param {Object} event - The event data object.
     */
    function populateFormForEdit(event) {
        eventIdInput.value = event.id;
        eventTitleInput.value = event.title || '';
        eventLocationInput.value = event.location || '';
        eventDescriptionInput.value = event.description || '';

        // Convert Firestore Timestamp to datetime-local format
        if (event.date && event.date.toDate) { // Check if it's a Firestore Timestamp
            const date = event.date.toDate(); // Convert to JS Date object
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            eventDateInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
        } else {
            eventDateInput.value = ''; // Clear if date is not valid
        }

        eventImageUrlInput.value = event.imageUrl || '';
        eventAgeGroupInput.value = event.ageGroup || 'all-ages'; // Set default if not found
        eventAgeGroupDisplayInput.value = event.ageGroupDisplay || 'All Ages'; // Set default
        eventRegistrationUrlInput.value = event.registrationUrl || ''; // Fix: use event.registrationUrl, not input's value
        eventQuoteInput.value = event.quote || '';

        formTitle.textContent = 'Edit Event';
        saveEventBtn.textContent = 'Update Event';
        cancelEditBtn.classList.remove('hidden');
        currentEditingEventId = event.id; // Set the current editing ID
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
            localStorage.removeItem('adminLoggedIn'); // Clear client-side flag consistent with previous logic
            window.location.href = 'admin_login.html'; // Redirect to the login page
        } catch (error) {
            console.error("Error signing out:", error);
            showFormMessage(`Logout failed: ${error.message}`, true); // Display error
        }
    });


    // --- Firestore CRUD Operations ---

    /**
     * Submits the event form (add or update).
     */
    eventForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // <<< IMPORTANT: Check for authenticated user BEFORE attempting CRUD operations >>>
        if (!auth.currentUser) {
            showFormMessage('You are not authenticated. Please log in again.', true);
            console.warn("Attempted CRUD operation without authenticated user.");
            // Optionally redirect to login immediately:
            // window.location.href = 'admin_login.html';
            return;
        }

        const title = eventTitleInput.value.trim();
        const location = eventLocationInput.value.trim();
        const description = eventDescriptionInput.value.trim();
        const imageUrl = eventImageUrlInput.value.trim();
        const ageGroup = eventAgeGroupInput.value;
        const ageGroupDisplay = eventAgeGroupDisplayInput.value.trim();
        const registrationUrl = eventRegistrationUrlInput.value.trim();
        const quote = eventQuoteInput.value.trim();

        // Convert date string from input to Timestamp
        let eventDateTimestamp = null;
        if (eventDateInput.value) {
            try {
                eventDateTimestamp = Timestamp.fromDate(new Date(eventDateInput.value));
            } catch (error) {
                showFormMessage('Invalid date/time format. Please use the datetime picker.', true);
                console.error('Date parsing error:', error);
                return;
            }
        } else {
            showFormMessage('Date & Time is required.', true);
            return;
        }

        if (!title || !description || !eventDateTimestamp) {
            showFormMessage('Title, Date & Time, and Description are required.', true);
            return;
        }

        const eventData = {
            title,
            location: location || 'TBD',
            description,
            date: eventDateTimestamp,
            imageUrl: imageUrl || 'https://placehold.co/600x400/7B68EE/FFFFFF?text=Event',
            ageGroup: ageGroup || 'all-ages',
            ageGroupDisplay: ageGroupDisplay || ageGroup.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '), // Auto-generate if empty
            registrationUrl: registrationUrl || '',
            quote: quote || ''
        };

        try {
            if (currentEditingEventId) {
                // Update existing event
                const eventRef = doc(db, 'events', currentEditingEventId);
                await updateDoc(eventRef, eventData);
                showFormMessage('Event updated successfully!', false);
            } else {
                // Add new event
                await addDoc(collection(db, 'events'), eventData);
                showFormMessage('Event added successfully!', false);
            }
            resetForm(); // Clear form after success
        } catch (error) {
            // More specific error handling for Firestore permissions
            if (error.code === 'permission-denied') {
                showFormMessage('Permission denied. Please ensure you are logged in with administrative privileges.', true);
            } else {
                showFormMessage(`Error saving event: ${error.message}`, true);
            }
            console.error("Error saving event:", error);
        }
    });

    // Cancel Edit button handler
    cancelEditBtn.addEventListener('click', resetForm);

    /**
     * Handles deleting an event.
     * @param {string} eventId - The ID of the event to delete.
     */
    async function deleteEvent(eventId) {
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
            const eventRef = doc(db, 'events', eventId);
            await deleteDoc(eventRef);
            showFormMessage('Event deleted successfully!', false);
            resetForm(); // Clear form if the deleted event was being edited
        } catch (error) {
            if (error.code === 'permission-denied') {
                showFormMessage('Permission denied. Please ensure you are logged in with administrative privileges.', true);
            } else {
                showFormMessage(`Error deleting event: ${error.message}`, true);
            }
            console.error("Error deleting event:", error);
        } finally {
            hideConfirmModal(); // Always hide the modal
        }
    }

    // --- Display Events in Admin Panel (Real-time with onSnapshot) ---

    /**
     * Creates an HTML card for an event, including edit/delete buttons.
     * (This function does not need changes related to auth)
     */
    function createAdminEventCard(event) {
        // Ensure event.date is a valid Firestore Timestamp object before conversion
        let eventDate;
        if (event.date && typeof event.date.toDate === 'function') {
            eventDate = event.date.toDate();
        } else if (event.date && typeof event.date.seconds === 'number') {
            // Fallback for direct {seconds, nanoseconds} object if not a full Timestamp object
            eventDate = new Date(event.date.seconds * 1000);
        } else {
            console.warn("Event has invalid date format, cannot display:", event);
            // Return a placeholder or empty div to avoid crashing
            const errorCard = document.createElement('div');
            errorCard.className = 'col event-item bg-red-100 text-red-700 p-4 rounded-lg';
            errorCard.innerHTML = `<p>Error: Invalid date for event ID: ${event.id || 'N/A'}</p>`;
            return errorCard;
        }

        const col = document.createElement('div');
        col.className = 'col event-item'; // Reuses existing event-item styling for grid layout
        col.setAttribute('data-event-id', event.id);

        col.innerHTML = `
            <div class="event-card fade-in visible"> <img src="${event.imageUrl || 'https://placehold.co/600x400/7B68EE/FFFFFF?text=Event'}"
                     alt="${event.title || 'Event Image'}" class="event-card-img">
                <div class="event-card-body">
                    <h3 class="event-title">${event.title || 'Untitled Event'}</h3>
                    <div class="event-meta">
                        <i class="far fa-calendar-alt"></i>
                        <span>${eventDate.toLocaleDateString()}</span>
                    </div>
                    <div class="event-meta">
                        <i class="far fa-clock"></i>
                        <span>${eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                    </div>
                    <div class="event-meta">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${event.location || 'TBD'}</span>
                    </div>
                    <p class="event-description">${event.description || 'No description available.'}</p>
                    ${event.quote ? `<div class="event-quote">"${event.quote}"</div>` : ''}
                    <div class="d-flex justify-content-between items-center mt-4">
                        <span class="age-badge badge-${event.ageGroup || 'all-ages'}">${event.ageGroupDisplay || 'All Ages'}</span>
                        ${event.registrationUrl ?
                            `<a href="${event.registrationUrl}" class="btn btn-sm btn-primary-custom rounded-pill" target="_blank">Register Now</a>` :
                            `<span class="text-sm text-gray-500">No registration link</span>`
                        }
                    </div>
                </div>
                <div class="admin-event-actions">
                    <button class="btn-warning edit-btn" data-id="${event.id}">
                        <i class="fas fa-edit mr-2"></i>Edit
                    </button>
                    <button class="btn-danger delete-btn" data-id="${event.id}">
                        <i class="fas fa-trash-alt mr-2"></i>Delete
                    </button>
                </div>
            </div>
        `;

        // Add event listeners for edit and delete buttons
        col.querySelector('.edit-btn').addEventListener('click', () => {
            populateFormForEdit(event);
        });

        col.querySelector('.delete-btn').addEventListener('click', () => {
            currentEditingEventId = event.id; // Store ID for deletion
            showConfirmModal(event.title);
        });

        return col;
    }


    /**
     * Fetches and displays events in real-time.
     */
    // <<< MODIFIED: Wrapped with onAuthStateChanged >>>
    function loadAndDisplayEvents() {
        // Show loading message
        loadingMessage.classList.remove('hidden');
        noEventsMessage.classList.add('hidden'); // Hide no events message initially
        adminEventsGrid.innerHTML = ''; // Clear existing events

        // Unsubscribe from previous snapshot listener if it exists
        if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
        }

        const eventsRef = collection(db, 'events');
        const q = query(eventsRef, orderBy('date', 'desc')); // Order by date, latest first

        // onSnapshot listener will now be established ONLY if authenticated
        unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
            const events = [];
            snapshot.forEach((doc) => {
                events.push({ id: doc.id, ...doc.data() });
            });

            adminEventsGrid.innerHTML = ''; // Clear grid before re-rendering

            if (events.length === 0) {
                noEventsMessage.classList.remove('hidden');
                loadingMessage.classList.add('hidden');
            } else {
                noEventsMessage.classList.add('hidden');
                loadingMessage.classList.add('hidden');
                events.forEach(event => {
                    const eventCard = createAdminEventCard(event);
                    adminEventsGrid.appendChild(eventCard);
                });
            }
        }, (error) => {
            console.error("Error fetching real-time events:", error);
            loadingMessage.classList.add('hidden');
            noEventsMessage.classList.remove('hidden'); // Show message in case of error
            // More specific error handling
            if (error.code === 'permission-denied') {
                 noEventsMessage.textContent = 'You do not have permission to view this data. Please log in.';
                 // If this happens often, consider redirecting to login.
                 // window.location.href = 'admin_login.html';
            } else {
                noEventsMessage.textContent = `Error loading events: ${error.message}`;
            }
        });
    }

    // --- Confirmation Modal Logic ---

    /**
     * Shows the confirmation modal.
     */
    function showConfirmModal(eventTitle) {
        confirmModal.querySelector('p').textContent = `Are you sure you want to delete "${eventTitle}"? This action cannot be undone.`;
        confirmModal.classList.add('show');
    }

    /**
     * Hides the confirmation modal.
     */
    function hideConfirmModal() {
        confirmModal.classList.remove('show');
        currentEditingEventId = null; // Clear ID after action or cancellation
    }

    confirmDeleteBtn.addEventListener('click', () => {
        if (currentEditingEventId) {
            deleteEvent(currentEditingEventId);
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
    // This ensures that the page only attempts to load/display events
    // (and thus trigger Firestore read rules) once a user is known to be authenticated.
    document.addEventListener('DOMContentLoaded', () => {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log("Admin Events page: User authenticated:", user.email);
                // User is signed in, proceed to load data and set up listeners
                localStorage.setItem('adminLoggedIn', 'true'); // Keep client-side flag consistent
                loadAndDisplayEvents(); // Now safe to load events
            } else {
                console.log("Admin Events page: No user authenticated. Redirecting to login.");
                localStorage.removeItem('adminLoggedIn'); // Ensure client-side flag is cleared
                if (unsubscribeSnapshot) {
                    unsubscribeSnapshot(); // Stop listening if user logs out unexpectedly
                    unsubscribeSnapshot = null;
                }
                window.location.href = 'admin_login.html'; // Redirect to login page
            }
        });
    });
