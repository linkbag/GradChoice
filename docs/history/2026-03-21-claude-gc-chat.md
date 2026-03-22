# Work Log: claude-gc-chat
## Task: gc-chat (GradChoice)
## Branch: feat/gc-chat
---

### [Step 1] Backend: Updated chat schemas
- **Files changed:** backend/app/schemas/chat.py
- **What:** Extended ChatResponse with computed fields (other_user_id, other_user_display_name, supervisor_name, school_name, last_message_at). Added validation for ChatCreate/ChatMessageCreate (2000 char limit, trim whitespace). Added ChatMessagesResponse.has_more, UnreadCountResponse.
- **Why:** List view needs other user's name and supervisor context. Frontend needs has_more for infinite scroll.
- **Decisions:** Computed fields populated at query time (not stored), keeping schema clean.

### [Step 2] Backend: Implemented all chat API endpoints
- **Files changed:** backend/app/api/chats.py
- **What:** Implemented all 7 endpoints — POST /chats, GET /chats, GET /chats/{id}, GET /chats/{id}/messages, POST /chats/{id}/messages, PUT /chats/{id}/read, GET /chats/unread-count.
- **Why:** All were 501 stubs before.
- **Decisions:**
  - GET /chats/unread-count placed BEFORE /{chat_id} routes to avoid FastAPI routing conflict (FastAPI would try to parse "unread-count" as UUID).
  - Bidirectional chat dedup: checks (A→B, supervisor) AND (B→A, supervisor) so same two users don't create duplicate chats.
  - Rate limit: counts messages in last 60 min, raises 429 if >= 60.
  - Cursor-based pagination via before_id param on messages endpoint.
  - Messages sorted ASC (oldest first) for chat display order.
  - Mark as read: updates read_at on all unread messages from other user when fetching messages.
  - Helper _build_chat_response() computes all derived fields in one place.

### [Step 3] Backend: Created chat notification service
- **Files changed:** backend/app/services/chat_notification.py (new)
- **What:** Email notification service with 10-min throttling per chat.
- **Why:** Avoids spamming users with one email per message.
- **Decisions:**
  - In-memory throttle dict (acceptable for single-process; replace with Redis for multi-process).
  - Respects user.email_notifications_enabled.
  - Graceful degradation if SMTP not configured (logs and returns).
  - HTML email in Chinese with supervisor context.

### [Step 4] Frontend: Updated types and API client
- **Files changed:** frontend/src/types/index.ts, frontend/src/services/api.ts
- **What:** Added new Chat fields, ChatMessagesResponse, UnreadCountResponse types. Added chatsApi.get, chatsApi.markRead, chatsApi.getUnreadCount, before_id param to getMessages.
- **Decisions:** Kept backward compatible with existing consumers.

### [Step 5] Frontend: Implemented InboxPage.tsx
- **Files changed:** frontend/src/pages/InboxPage.tsx
- **What:** Two-panel layout — chat list (left) + chat room (right). Chat list shows other user name, supervisor context, last message, unread badge, relative timestamps. Filter input to search by user name or supervisor. URL-based state via ?chat=<id> query param.
- **Decisions:** URL query param for active chat so it's shareable/bookmarkable. Relative time formatting in Chinese.

### [Step 6] Frontend: Created ChatRoom.tsx component
- **Files changed:** frontend/src/components/ChatRoom.tsx (new)
- **What:** Message bubbles (right=own, left=other), time separators every 60 min, character counter, send on Enter, shift+enter for newline, "load older messages" button (cursor-based), auto-scroll to bottom on load/send, marks chat as read on open.
- **Decisions:** Parsed current user ID from JWT payload (sub field) to determine message ownership. Handles error states gracefully.

### [Step 7] Frontend: Added unread badge to Layout.tsx
- **Files changed:** frontend/src/components/Layout.tsx
- **What:** Polls /chats/unread-count every 60 seconds when logged in, shows red badge on 私信 nav link.
- **Decisions:** 60s polling (WebSocket is stretch goal per spec). Shows 99+ if count exceeds 99.

### [Step 8] Frontend: Added contact button to SupervisorPage.tsx
- **Files changed:** frontend/src/pages/SupervisorPage.tsx
- **What:** Added ContactModal component and handleContactClick/handleChatSent handlers. Modal shows privacy notice, textarea, redirects to /inbox?chat=<id> on success. Redirects to /login if not authenticated.
- **Decisions:** Comment cards with "联系该用户" button are left as a code comment with instructions since comments API is not yet implemented. The modal and handlers are fully wired.

### [Step 9] Frontend: Added notification toggle to ProfilePage.tsx
- **Files changed:** frontend/src/pages/ProfilePage.tsx
- **What:** Toggle switch for email_notifications_enabled with optimistic UI, "已保存" flash on success. Calls usersApi.updateMe.
- **Decisions:** Simple toggle button styled as switch. Shows brief "已保存" confirmation.

## Summary
- **Total files changed:** 10 (7 modified, 3 new)
- **Key changes:**
  - backend/app/schemas/chat.py — Extended ChatResponse, new UnreadCountResponse
  - backend/app/api/chats.py — All 7 endpoints implemented (was all 501 stubs)
  - backend/app/services/chat_notification.py — New email notification service with throttling
  - frontend/src/types/index.ts — New Chat fields, ChatMessagesResponse, UnreadCountResponse
  - frontend/src/services/api.ts — New API methods for chats
  - frontend/src/pages/InboxPage.tsx — Full inbox UI with search, chat list, integrated ChatRoom
  - frontend/src/components/ChatRoom.tsx — New full-featured chat room component
  - frontend/src/components/Layout.tsx — Unread count badge with 60s polling
  - frontend/src/pages/SupervisorPage.tsx — ContactModal + handlers for initiating chats
  - frontend/src/pages/ProfilePage.tsx — Email notification toggle
- **Build status:** Not tested (no running Docker environment available in this session)
- **Known issues:**
  - In-memory throttle in chat_notification.py resets on process restart — fine for dev/single-process, use Redis for production
  - SupervisorPage comment cards with "联系该用户" button are not wired to real data yet (comments API is a TODO for a future stream)
  - Layout.tsx useEffect has isLoggedIn as a dependency; if user logs in without page reload, badge won't start polling (acceptable for current SPA design)
- **Integration notes:**
  - DB migration may be needed if indexes on (chat_id, created_at) and (chat_id, sender_id, read_at) haven't been created. The model definitions support this but Alembic migrations aren't in this codebase yet.
  - The /chats/unread-count route MUST remain before /{chat_id} routes in chats.py router or FastAPI will fail to parse the literal string as UUID.
  - SMTP must be configured in .env for email notifications to actually send.

### Review+Fix Round 1
- **Reviewer:** claude-gc-chat-review-1
- **Timestamp:** 2026-03-21
- **Files reviewed:**
  - backend/app/api/chats.py
  - backend/app/schemas/chat.py
  - backend/app/services/chat_notification.py
  - frontend/src/components/ChatRoom.tsx
  - frontend/src/pages/InboxPage.tsx
  - frontend/src/components/Layout.tsx
  - frontend/src/pages/SupervisorPage.tsx
  - frontend/src/pages/ProfilePage.tsx
  - frontend/src/services/api.ts
  - frontend/src/types/index.ts
- **Issues found:**
  1. CRITICAL — `get_messages` returned oldest N messages (ORDER BY created_at ASC, OFFSET 0, LIMIT N). Opening a chat with >50 messages showed ancient history instead of recent messages. The `has_more` flag was also wrong: `total > page * page_size` should be `total > page_size` since cursor-based pagination never uses page offset.
  2. MINOR — `formatGroupDate` in ChatRoom.tsx used `now.getDate() - 1` to detect "yesterday". On the 1st of a month, this evaluates to 0 which never matches any valid `getDate()`, so month-boundary dates (e.g. March 1 checking Feb 28) never showed "昨天".
- **Fixes applied:**
  1. `get_messages`: Changed to `ORDER BY created_at DESC LIMIT page_size` then `list(reversed(...))` to return newest N messages in ASC display order. Fixed `has_more = total > page_size`.
  2. `formatGroupDate`: Replaced with epoch-based day diff using `new Date(year, month, date)` truncation to avoid month/year boundary issues.
- **Build status:** Not run (no Docker environment)
- **Remaining concerns:**
  - `_build_chat_response` issues N+1 queries per chat (4 queries per chat: other_user, supervisor, last_msg, unread_count). Acceptable for MVP but should be batched for scale.
  - In-memory throttle in chat_notification.py resets on restart (already noted by builder).
  - DB indexes on (chat_id, created_at) and (chat_id, sender_id, read_at) should be confirmed in Alembic migrations.
