/**
 * 社区 UGC API（动态 / 找搭子）
 */
(function (global) {
    const PLACEHOLDER_POST_IMAGE = 'assets/images/covers/feed-route.jpg';

    function apiBase() {
        if (global.CitywalkAuth && CitywalkAuth.CW_API) return CitywalkAuth.CW_API;
        const h = global.location && global.location.hostname;
        return (h === 'localhost' || h === '127.0.0.1')
            ? 'http://localhost:5000/api/citywalk'
            : 'https://noomings-backend.zeabur.app/api/citywalk';
    }

    async function authHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (global.CitywalkAuth && CitywalkAuth.getToken()) {
            headers.Authorization = 'Bearer ' + CitywalkAuth.getToken();
        }
        return headers;
    }

    async function fetchPosts(params) {
        const q = new URLSearchParams(params || {});
        const headers = {};
        if (global.CitywalkAuth && CitywalkAuth.getToken()) {
            headers.Authorization = 'Bearer ' + CitywalkAuth.getToken();
        }
        const res = await fetch(apiBase() + '/community/posts?' + q.toString(), { headers: headers });
        const body = await res.json().catch(function () { return {}; });
        if (!res.ok || !body.success) {
            throw new Error(body.message || '加载动态失败');
        }
        return body.posts || [];
    }

    async function createPost(payload) {
        const res = await fetch(apiBase() + '/community/posts', {
            method: 'POST',
            headers: await authHeaders(),
            body: JSON.stringify(payload),
        });
        const body = await res.json().catch(function () { return {}; });
        if (!res.ok || !body.success) {
            throw new Error(body.message || '发布失败');
        }
        return body.post;
    }

    async function fetchBuddies(params) {
        const q = new URLSearchParams(params || {});
        const res = await fetch(apiBase() + '/community/buddies?' + q.toString());
        const body = await res.json().catch(function () { return {}; });
        if (!res.ok || !body.success) {
            throw new Error(body.message || '加载找搭子失败');
        }
        return body.buddies || [];
    }

    async function createBuddy(payload) {
        const res = await fetch(apiBase() + '/community/buddies', {
            method: 'POST',
            headers: await authHeaders(),
            body: JSON.stringify(payload),
        });
        const body = await res.json().catch(function () { return {}; });
        if (!res.ok || !body.success) {
            throw new Error(body.message || '发起失败');
        }
        return body.buddy;
    }

    async function joinBuddy(buddyId) {
        const res = await fetch(apiBase() + '/community/buddies/' + encodeURIComponent(buddyId) + '/join', {
            method: 'POST',
            headers: await authHeaders(),
        });
        const body = await res.json().catch(function () { return {}; });
        if (!res.ok || !body.success) {
            throw new Error(body.message || '加入失败');
        }
        return body.buddy;
    }

    async function likePost(postId) {
        const res = await fetch(apiBase() + '/community/posts/' + encodeURIComponent(postId) + '/like', {
            method: 'POST',
            headers: await authHeaders(),
        });
        const body = await res.json().catch(function () { return {}; });
        if (!res.ok || !body.success) throw new Error(body.message || '点赞失败');
        return body.post;
    }

    async function deletePost(postId) {
        const res = await fetch(apiBase() + '/community/posts/' + encodeURIComponent(postId), {
            method: 'DELETE',
            headers: await authHeaders(),
        });
        const body = await res.json().catch(function () { return {}; });
        if (!res.ok || !body.success) throw new Error(body.message || '删除失败');
    }

    async function reportPost(postId, reason) {
        const res = await fetch(apiBase() + '/community/posts/' + encodeURIComponent(postId) + '/report', {
            method: 'POST',
            headers: await authHeaders(),
            body: JSON.stringify({ reason: reason || '' }),
        });
        const body = await res.json().catch(function () { return {}; });
        if (!res.ok || !body.success) throw new Error(body.message || '举报失败');
        return body;
    }

    global.CitywalkCommunityApi = {
        PLACEHOLDER_POST_IMAGE,
        fetchPosts,
        createPost,
        fetchBuddies,
        createBuddy,
        joinBuddy,
        likePost,
        deletePost,
        reportPost,
        refreshAll: async function () {
            const posts = await fetchPosts({ limit: '80' });
            const buddies = await fetchBuddies({ limit: '80' });
            return { posts: posts, buddies: buddies };
        },
    };
})(typeof window !== 'undefined' ? window : globalThis);
