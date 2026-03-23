import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/* ─── Types ─── */
export interface PublicProfile {
    uid: string;
    displayName: string;
    photoURL: string;
    searchName: string;
}

export interface FriendRequest {
    id: string;
    from: string;
    to: string;
    fromName: string;
    fromPhoto: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: unknown;
}

export interface FriendEntry {
    uid: string;
    addedAt: unknown;
    displayName: string;
    photoURL: string;
}

export interface WatchedFilmEntry {
    filmId: string;
    title: string;
    addedAt: unknown;
    reaction?: 'liked' | 'neutral' | 'disliked';
}

/* ─── Search ─── */
export async function searchUsers(queryStr: string, currentUid: string): Promise<PublicProfile[]> {
    const q = queryStr.toLowerCase().trim();
    if (q.length < 2) return [];

    // Firestore prefix search using range
    const end = q + '\uf8ff';
    const snap = await getDocs(
        query(
            collection(db, 'publicProfiles'),
            where('searchName', '>=', q),
            where('searchName', '<=', end),
            limit(20)
        )
    );

    return snap.docs
        .map((d) => d.data() as PublicProfile)
        .filter((p) => p.uid !== currentUid);
}

/* ─── Friend Requests ─── */
export async function sendFriendRequest(
    from: string,
    to: string,
    fromName: string,
    fromPhoto: string
): Promise<void> {
    // Check if already friends
    const friendDoc = await getDoc(doc(db, 'users', from, 'friends', to));
    if (friendDoc.exists()) return;

    // Check existing requests in both directions
    const [existingSnap, reverseSnap] = await Promise.all([
        getDocs(query(
            collection(db, 'friendRequests'),
            where('from', '==', from),
            where('to', '==', to)
        )),
        getDocs(query(
            collection(db, 'friendRequests'),
            where('from', '==', to),
            where('to', '==', from)
        )),
    ]);

    // Clean up old accepted/rejected requests so we can re-add
    const cleanupPromises: Promise<void>[] = [];
    existingSnap.docs.forEach((d) => {
        const status = d.data().status;
        if (status === 'pending') return; // Don't touch pending ones
        cleanupPromises.push(deleteDoc(doc(db, 'friendRequests', d.id)));
    });
    reverseSnap.docs.forEach((d) => {
        const status = d.data().status;
        if (status === 'pending') return;
        cleanupPromises.push(deleteDoc(doc(db, 'friendRequests', d.id)));
    });
    if (cleanupPromises.length > 0) await Promise.all(cleanupPromises);

    // Block only if there's a pending request
    const hasPendingOutgoing = existingSnap.docs.some((d) => d.data().status === 'pending');
    const hasPendingIncoming = reverseSnap.docs.some((d) => d.data().status === 'pending');
    if (hasPendingOutgoing || hasPendingIncoming) return;

    await addDoc(collection(db, 'friendRequests'), {
        from,
        to,
        fromName,
        fromPhoto,
        status: 'pending',
        createdAt: serverTimestamp(),
    });
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
    const reqRef = doc(db, 'friendRequests', requestId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) return;

    const data = reqSnap.data();
    const fromUid = data.from as string;
    const toUid = data.to as string;

    // Get both profiles for the friend entries
    const [fromProfile, toProfile] = await Promise.all([
        getDoc(doc(db, 'publicProfiles', fromUid)),
        getDoc(doc(db, 'publicProfiles', toUid)),
    ]);

    const fromData = fromProfile.data();
    const toData = toProfile.data();

    // Add to both users' friends subcollections
    await Promise.all([
        setDoc(doc(db, 'users', fromUid, 'friends', toUid), {
            uid: toUid,
            addedAt: serverTimestamp(),
            displayName: toData?.displayName || '',
            photoURL: toData?.photoURL || '',
        }),
        setDoc(doc(db, 'users', toUid, 'friends', fromUid), {
            uid: fromUid,
            addedAt: serverTimestamp(),
            displayName: fromData?.displayName || '',
            photoURL: fromData?.photoURL || '',
        }),
        updateDoc(reqRef, { status: 'accepted' }),
    ]);
}

export async function rejectFriendRequest(requestId: string): Promise<void> {
    await updateDoc(doc(db, 'friendRequests', requestId), { status: 'rejected' });
}

export async function cancelFriendRequest(requestId: string): Promise<void> {
    await deleteDoc(doc(db, 'friendRequests', requestId));
}

export async function getPendingRequests(uid: string): Promise<FriendRequest[]> {
    const snap = await getDocs(
        query(
            collection(db, 'friendRequests'),
            where('to', '==', uid),
            where('status', '==', 'pending')
        )
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FriendRequest));
}

export async function getSentRequests(uid: string): Promise<FriendRequest[]> {
    const snap = await getDocs(
        query(
            collection(db, 'friendRequests'),
            where('from', '==', uid),
            where('status', '==', 'pending')
        )
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FriendRequest));
}

export async function getFriends(uid: string): Promise<FriendEntry[]> {
    const snap = await getDocs(collection(db, 'users', uid, 'friends'));
    return snap.docs.map((d) => d.data() as FriendEntry);
}

export async function removeFriend(uid: string, friendUid: string): Promise<void> {
    await Promise.all([
        deleteDoc(doc(db, 'users', uid, 'friends', friendUid)),
        deleteDoc(doc(db, 'users', friendUid, 'friends', uid)),
    ]);
}

export async function getFriendWatchedFilms(friendUid: string): Promise<WatchedFilmEntry[]> {
    const snap = await getDocs(
        query(
            collection(db, 'users', friendUid, 'watchedFilms'),
            orderBy('addedAt', 'desc'),
            limit(30)
        )
    );
    return snap.docs.map((d) => ({
        filmId: d.id,
        ...d.data(),
    } as WatchedFilmEntry));
}

/* ─── Activity Feed ─── */
export interface ActivityItem {
    friendUid: string;
    friendName: string;
    friendPhoto: string;
    filmId: string;
    filmTitle: string;
    reaction?: string;
    addedAt: unknown;
}

export async function getFriendActivity(friends: FriendEntry[]): Promise<ActivityItem[]> {
    if (friends.length === 0) return [];

    const allItems: ActivityItem[] = [];

    // Fetch latest films for each friend (in parallel, max 10 friends)
    const batch = friends.slice(0, 10);
    const results = await Promise.allSettled(
        batch.map(async (friend) => {
            const snap = await getDocs(
                query(
                    collection(db, 'users', friend.uid, 'watchedFilms'),
                    orderBy('addedAt', 'desc'),
                    limit(5)
                )
            );
            return snap.docs.map((d) => ({
                friendUid: friend.uid,
                friendName: friend.displayName,
                friendPhoto: friend.photoURL,
                filmId: d.id,
                filmTitle: (d.data().title as string) || '',
                reaction: d.data().reaction as string | undefined,
                addedAt: d.data().addedAt,
            }));
        })
    );

    results.forEach((r) => {
        if (r.status === 'fulfilled') allItems.push(...r.value);
    });

    // Sort by addedAt descending
    allItems.sort((a, b) => {
        const aTime = (a.addedAt as { seconds?: number })?.seconds || 0;
        const bTime = (b.addedAt as { seconds?: number })?.seconds || 0;
        return bTime - aTime;
    });

    return allItems.slice(0, 30);
}
