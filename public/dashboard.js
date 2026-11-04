
const API = '/api';

const token = localStorage.getItem('token');

let user = null;

try {
    user = JSON.parse(localStorage.getItem('user') || 'null');
} catch (error) {
    localStorage.removeItem('user');
}

if (!token || !user) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
} else {

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    const getElement = id => document.getElementById(id);

    // USER PROFILE
    function setupUserProfile() {
        const name = user.name || 'User';
        const role = user.role || 'customer';
        const initial = name.charAt(0).toUpperCase();

        getElement('userName').textContent = name;
        getElement('userRole').textContent = role.toUpperCase();

        if (getElement('sidebarUserName')) {
            getElement('sidebarUserName').textContent = name;
        }

        if (getElement('sidebarUserRole')) {
            getElement('sidebarUserRole').textContent = role.toUpperCase();
        }

        if (getElement('welcomeName')) {
            getElement('welcomeName').textContent = name.split(' ')[0];
        }

        if (getElement('sidebarAvatar')) {
            getElement('sidebarAvatar').textContent = initial;
        }

        if (getElement('topAvatar')) {
            getElement('topAvatar').textContent = initial;
        }

        // Customer-only features
        if (role !== 'customer') {
            getElement('create').style.display = 'none';

            if (getElement('createLink')) {
                getElement('createLink').style.display = 'none';
            }

            if (getElement('bannerCreateLink')) {
                getElement('bannerCreateLink').style.display = 'none';
            }
        }

        // Admin-only features
        if (role === 'admin') {
            getElement('usersLink').style.display = 'block';
            getElement('users').style.display = 'block';
        }
    }

    setupUserProfile();

    // LOGOUT
    getElement('logoutBtn').addEventListener('click', () => {
        if (!confirm('Are you sure you want to logout?')) return;

        localStorage.removeItem('token');
        localStorage.removeItem('user');

        window.location.href = '/';
    });

    // MESSAGE HELPER
    function showMessage(element, message, success = false) {
        element.textContent = message;
        element.style.color = success ? '#15803d' : '#dc2626';
    }

    // CREATE TICKET
    getElement('ticketForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const messageBox = getElement('formMessage');
        const submitButton = e.target.querySelector('button[type="submit"]');

        const subject = getElement('subject').value.trim();
        const message = getElement('message').value.trim();
        const priority = getElement('priority').value;

        if (!subject || !message) {
            showMessage(messageBox, 'Please fill in all required fields.');
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Creating...';

        try {
            const response = await fetch(`${API}/tickets`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    subject,
                    message,
                    priority
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Ticket creation failed');
            }

            showMessage(messageBox, 'Ticket created successfully!', true);

            e.target.reset();

            await loadTickets();
            await loadStats();

            getElement('tickets').scrollIntoView({
                behavior: 'smooth'
            });

        } catch (error) {
            showMessage(messageBox, error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Submit Support Ticket →';
        }
    });

    // DASHBOARD STATISTICS
    async function loadStats() {
        try {
            const response = await fetch(
                `${API}/tickets/dashboard/stats`,
                { headers }
            );

            if (!response.ok) {
                throw new Error('Could not load statistics');
            }

            const stats = await response.json();

            getElement('totalTickets').textContent = stats.total ?? 0;
            getElement('openTickets').textContent = stats.open ?? 0;
            getElement('progressTickets').textContent = stats.inProgress ?? 0;
            getElement('resolvedTickets').textContent = stats.resolved ?? 0;

        } catch (error) {
            console.error('Statistics Error:', error.message);
        }
    }

    // BADGE CREATOR
    function createBadge(text, type) {
        const badge = document.createElement('span');

        badge.className = `ticket-badge ${type}`;
        badge.textContent = text;

        return badge;
    }

    // BUTTON CREATOR
    function createButton(text, callback) {
        const button = document.createElement('button');

        button.type = 'button';
        button.textContent = text;
        button.addEventListener('click', callback);

        return button;
    }

    // TICKET REPLIES AND ATTACHMENTS
    async function openTicketReplies(ticketId) {
        const section = getElement('replySection');

        section.replaceChildren();

        const panel = document.createElement('div');
        panel.className = 'panel';

        const heading = document.createElement('h2');
        heading.textContent = 'Ticket Conversation';

        const description = document.createElement('p');
        description.textContent = `Ticket ID: ${ticketId}`;

        panel.append(heading, description);

        const loading = document.createElement('p');
        loading.textContent = 'Loading conversation...';

        panel.appendChild(loading);
        section.appendChild(panel);

        try {
            const response = await fetch(
                `${API}/tickets/${ticketId}`,
                { headers }
            );

            if (!response.ok) {
                throw new Error('Could not load ticket details');
            }

            const ticket = await response.json();

            panel.replaceChildren();

            const title = document.createElement('h2');
            title.textContent = 'Ticket Conversation';

            const subject = document.createElement('h3');
            subject.textContent = ticket.subject;

            panel.append(title, subject);

            // REPLIES
            const replyHeading = document.createElement('h3');
            replyHeading.textContent = 'Messages';
            replyHeading.style.marginTop = '20px';

            panel.appendChild(replyHeading);

            if (ticket.replies && ticket.replies.length > 0) {

                ticket.replies.forEach(reply => {
                    const messageCard = document.createElement('div');
                    messageCard.className = 'ticket-card';

                    const sender = document.createElement('strong');
                    sender.textContent = reply.sender?.name || 'User';

                    const message = document.createElement('p');
                    message.textContent = reply.message;

                    const date = document.createElement('small');
                    date.textContent = reply.createdAt
                        ? new Date(reply.createdAt).toLocaleString()
                        : '';

                    messageCard.append(sender, message, date);
                    panel.appendChild(messageCard);
                });

            } else {
                const empty = document.createElement('p');
                empty.textContent = 'No replies yet.';
                panel.appendChild(empty);
            }

            // ATTACHMENTS
            const attachmentHeading = document.createElement('h3');
            attachmentHeading.textContent = 'Attachments';
            attachmentHeading.style.marginTop = '20px';

            panel.appendChild(attachmentHeading);

            if (ticket.attachments && ticket.attachments.length > 0) {

                ticket.attachments.forEach(attachment => {

                    const downloadButton = createButton(
                        `Download ${attachment.filename}`,
                        async () => {
                            try {
                                const fileResponse = await fetch(
                                    `${API}/tickets/${ticketId}/attachments/${encodeURIComponent(attachment.path)}`,
                                    {
                                        headers: {
                                            'Authorization': `Bearer ${token}`
                                        }
                                    }
                                );

                                if (!fileResponse.ok) {
                                    throw new Error('Could not download attachment');
                                }

                                const blob = await fileResponse.blob();
                                const url = URL.createObjectURL(blob);

                                const link = document.createElement('a');
                                link.href = url;
                                link.download = attachment.filename;

                                document.body.appendChild(link);
                                link.click();
                                link.remove();

                                setTimeout(() => {
                                    URL.revokeObjectURL(url);
                                }, 1000);

                            } catch (error) {
                                alert(error.message);
                            }
                        }
                    );

                    panel.appendChild(downloadButton);
                });

            } else {
                const empty = document.createElement('p');
                empty.textContent = 'No attachments available.';
                panel.appendChild(empty);
            }

            // REPLY FORM
            if (ticket.status !== 'Closed') {

                const replyForm = document.createElement('form');
                replyForm.style.marginTop = '20px';

                const textarea = document.createElement('textarea');
                textarea.placeholder = 'Write your reply...';
                textarea.required = true;
                textarea.maxLength = 3000;

                const sendButton = document.createElement('button');
                sendButton.type = 'submit';
                sendButton.textContent = 'Send Reply';

                replyForm.append(textarea, sendButton);

                replyForm.addEventListener('submit', async (e) => {
                    e.preventDefault();

                    const message = textarea.value.trim();

                    if (!message) return;

                    sendButton.disabled = true;
                    sendButton.textContent = 'Sending...';

                    try {
                        const replyResponse = await fetch(
                            `${API}/tickets/${ticketId}/replies`,
                            {
                                method: 'POST',
                                headers,
                                body: JSON.stringify({ message })
                            }
                        );

                        const result = await replyResponse.json();

                        if (!replyResponse.ok) {
                            throw new Error(result.message || 'Reply failed');
                        }

                        await openTicketReplies(ticketId);

                    } catch (error) {
                        alert(error.message);
                        sendButton.disabled = false;
                        sendButton.textContent = 'Send Reply';
                    }
                });

                panel.appendChild(replyForm);

            } else {
                const closedMessage = document.createElement('p');
                closedMessage.textContent = 'This ticket is closed. Replies are disabled.';
                panel.appendChild(closedMessage);
            }

            const closeButton = createButton('Close Conversation', () => {
                section.replaceChildren();
            });

            closeButton.style.marginTop = '15px';
            panel.appendChild(closeButton);

        } catch (error) {
            panel.replaceChildren();

            const errorText = document.createElement('p');
            errorText.textContent = error.message;

            panel.appendChild(errorText);
        }
    }

    // LOAD TICKETS
    async function loadTickets() {
        const list = getElement('ticketList');

        list.textContent = 'Loading tickets...';

        const params = new URLSearchParams();

        const search = getElement('searchTickets').value.trim();
        const status = getElement('statusFilter').value;
        const priority = getElement('priorityFilter').value;

        if (search) params.set('search', search);
        if (status) params.set('status', status);
        if (priority) params.set('priority', priority);

        try {
            const response = await fetch(
                `${API}/tickets/search?${params.toString()}`,
                { headers }
            );

            if (!response.ok) {
                throw new Error('Could not load tickets');
            }

            const tickets = await response.json();

            let agents = [];

            if (user.role === 'admin') {
                const usersResponse = await fetch(`${API}/users`, { headers });

                if (usersResponse.ok) {
                    const users = await usersResponse.json();

                    agents = users.filter(item => item.role === 'agent');
                }
            }

            list.replaceChildren();

            if (!Array.isArray(tickets) || tickets.length === 0) {

                const empty = document.createElement('div');
                empty.className = 'empty-tickets';

                const icon = document.createElement('div');
                icon.textContent = '🎫';

                const title = document.createElement('h3');
                title.textContent = 'No Tickets Found';

                const description = document.createElement('p');
                description.textContent = 'No tickets match your current search or filters.';

                empty.append(icon, title, description);
                list.appendChild(empty);

                return;
            }

            tickets.forEach(ticket => {

                const card = document.createElement('div');
                card.className = 'ticket-card';

                // HEADER
                const header = document.createElement('div');
                header.className = 'ticket-card-header';

                const title = document.createElement('h3');
                title.textContent = ticket.subject;

                const ticketId = document.createElement('small');
                ticketId.textContent = `ID: ${ticket._id}`;

                header.append(title, ticketId);

                // BADGES
                const badges = document.createElement('div');
                badges.className = 'ticket-badges';

                const statusClass = ticket.status
                    .toLowerCase()
                    .replace(/\s+/g, '-');

                const priorityClass = ticket.priority.toLowerCase();

                badges.append(
                    createBadge(ticket.status, `status-${statusClass}`),
                    createBadge(`${ticket.priority} Priority`, `priority-${priorityClass}`)
                );

                // DESCRIPTION
                const description = document.createElement('p');
                description.textContent = ticket.message;

                // CUSTOMER
                const customer = document.createElement('p');
                customer.textContent =
                    `Customer: ${ticket.customerName || ticket.customer?.name || 'Customer'}`;

                // DATE
                const date = document.createElement('p');
                date.textContent = `Created: ${
                    ticket.createdAt
                        ? new Date(ticket.createdAt).toLocaleString()
                        : 'Not available'
                }`;

                // ASSIGNED AGENT
                const assigned = document.createElement('p');
                assigned.textContent = ticket.assignedTo
                    ? `Assigned to: ${ticket.assignedTo.name || 'Support Agent'}`
                    : 'Assigned to: Not assigned';

                card.append(
                    header,
                    badges,
                    description,
                    customer,
                    date,
                    assigned
                );

                // ACTIONS
                const actions = document.createElement('div');
                actions.className = 'ticket-actions';

                // REPLY BUTTON
                const replyButton = createButton('View / Reply', () => {
                    openTicketReplies(ticket._id);

                    getElement('replySection').scrollIntoView({
                        behavior: 'smooth'
                    });
                });

                actions.appendChild(replyButton);

                // AGENT AND ADMIN STATUS UPDATE
                if (user.role === 'admin' || user.role === 'agent') {

                    const statusSelect = document.createElement('select');

                    ['Open', 'In Progress', 'Resolved', 'Closed'].forEach(value => {
                        const option = document.createElement('option');

                        option.value = value;
                        option.textContent = value;
                        option.selected = ticket.status === value;

                        statusSelect.appendChild(option);
                    });

                    const updateButton = createButton('Update Status', async () => {

                        updateButton.disabled = true;
                        updateButton.textContent = 'Updating...';

                        try {
                            const updateResponse = await fetch(
                                `${API}/tickets/${ticket._id}`,
                                {
                                    method: 'PUT',
                                    headers,
                                    body: JSON.stringify({
                                        status: statusSelect.value
                                    })
                                }
                            );

                            const result = await updateResponse.json();

                            if (!updateResponse.ok) {
                                throw new Error(result.message || 'Status update failed');
                            }

                            await loadTickets();
                            await loadStats();

                        } catch (error) {
                            alert(error.message);
                            updateButton.disabled = false;
                            updateButton.textContent = 'Update Status';
                        }
                    });

                    actions.append(statusSelect, updateButton);
                }

                // ADMIN AGENT ASSIGNMENT
                if (user.role === 'admin') {

                    const agentSelect = document.createElement('select');

                    const defaultOption = document.createElement('option');
                    defaultOption.value = '';
                    defaultOption.textContent = 'Select Agent';

                    agentSelect.appendChild(defaultOption);

                    agents.forEach(agent => {
                        const option = document.createElement('option');

                        option.value = agent._id;
                        option.textContent = agent.name;

                        option.selected =
                            String(ticket.assignedTo?._id || ticket.assignedTo || '') ===
                            String(agent._id);

                        agentSelect.appendChild(option);
                    });

                    const assignButton = createButton('Assign Agent', async () => {

                        if (!agentSelect.value) {
                            alert('Please select an agent.');
                            return;
                        }

                        assignButton.disabled = true;
                        assignButton.textContent = 'Assigning...';

                        try {
                            const assignResponse = await fetch(
                                `${API}/tickets/${ticket._id}`,
                                {
                                    method: 'PUT',
                                    headers,
                                    body: JSON.stringify({
                                        assignedTo: agentSelect.value
                                    })
                                }
                            );

                            const result = await assignResponse.json();

                            if (!assignResponse.ok) {
                                throw new Error(result.message || 'Agent assignment failed');
                            }

                            alert('Agent assigned successfully!');

                            await loadTickets();

                        } catch (error) {
                            alert(error.message);
                            assignButton.disabled = false;
                            assignButton.textContent = 'Assign Agent';
                        }
                    });

                    actions.append(agentSelect, assignButton);
                }

                card.appendChild(actions);
                list.appendChild(card);
            });

        } catch (error) {
            list.textContent = error.message;
        }
    }

    // ADMIN USER MANAGEMENT
    async function loadUsers() {
        if (user.role !== 'admin') return;

        const userList = getElement('userList');

        userList.textContent = 'Loading users...';

        try {
            const response = await fetch(`${API}/users`, { headers });

            if (!response.ok) {
                throw new Error('Could not load users');
            }

            const users = await response.json();

            userList.replaceChildren();

            if (!Array.isArray(users) || users.length === 0) {
                userList.textContent = 'No users found.';
                return;
            }

            users.forEach(item => {

                const card = document.createElement('div');
                card.className = 'ticket-card';

                const name = document.createElement('h3');
                name.textContent = item.name;

                const email = document.createElement('p');
                email.textContent = item.email;

                const roleText = document.createElement('p');
                roleText.textContent = `Current Role: ${item.role.toUpperCase()}`;

                const roleSelect = document.createElement('select');

                ['customer', 'agent', 'admin'].forEach(role => {
                    const option = document.createElement('option');

                    option.value = role;
                    option.textContent = role.toUpperCase();
                    option.selected = item.role === role;

                    roleSelect.appendChild(option);
                });

                const updateButton = createButton('Update Role', async () => {

                    if (item._id === user.id || item._id === user._id) {
                        alert('You cannot change your own role.');
                        return;
                    }

                    updateButton.disabled = true;
                    updateButton.textContent = 'Updating...';

                    try {
                        const updateResponse = await fetch(
                            `${API}/users/${item._id}/role`,
                            {
                                method: 'PUT',
                                headers,
                                body: JSON.stringify({
                                    role: roleSelect.value
                                })
                            }
                        );

                        const result = await updateResponse.json();

                        if (!updateResponse.ok) {
                            throw new Error(result.message || 'Role update failed');
                        }

                        alert('User role updated successfully!');

                        await loadUsers();

                    } catch (error) {
                        alert(error.message);
                        updateButton.disabled = false;
                        updateButton.textContent = 'Update Role';
                    }
                });

                card.append(
                    name,
                    email,
                    roleText,
                    roleSelect,
                    updateButton
                );

                userList.appendChild(card);
            });

        } catch (error) {
            userList.textContent = error.message;
        }
    }

    // ATTACHMENT UPLOAD
    getElement('attachmentForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const ticketId = getElement('attachmentTicketId').value.trim();
        const file = getElement('attachmentFile').files[0];
        const message = getElement('attachmentMessage');
        const submitButton = e.target.querySelector('button[type="submit"]');

        if (!ticketId || !file) {
            showMessage(message, 'Please enter a Ticket ID and choose a file.');
            return;
        }

        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
            'application/pdf'
        ];

        if (!allowedTypes.includes(file.type)) {
            showMessage(message, 'Only JPG, PNG, WEBP and PDF files are allowed.');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showMessage(message, 'File size must be less than 5 MB.');
            return;
        }

        const formData = new FormData();
        formData.append('attachment', file);

        submitButton.disabled = true;
        submitButton.textContent = 'Uploading...';

        try {
            const response = await fetch(
                `${API}/tickets/${ticketId}/attachments`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Attachment upload failed');
            }

            showMessage(message, 'Attachment uploaded successfully!', true);

            e.target.reset();

        } catch (error) {
            showMessage(message, error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Upload Attachment ↑';
        }
    });

    // FILTER BUTTON
    getElement('filterBtn').addEventListener('click', loadTickets);

    // SEARCH WITH ENTER
    getElement('searchTickets').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            loadTickets();
        }
    });

    // SIDEBAR NAVIGATION
    document.querySelectorAll('.sidebar nav a[href^="#"]').forEach(link => {

        link.addEventListener('click', () => {

            document.querySelectorAll('.sidebar nav a').forEach(item => {
                item.classList.remove('active');
            });

            link.classList.add('active');
        });
    });

    // INITIAL LOADING
    loadStats();
    loadTickets();
    loadUsers();

}
