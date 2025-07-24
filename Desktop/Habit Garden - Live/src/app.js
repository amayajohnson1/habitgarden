import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, deleteDoc, onSnapshot, updateDoc, arrayUnion, arrayRemove, serverTimestamp, query, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { CheckCircle, Circle, Plus, Trash2, Sprout, X, Target, Flame, Edit, MessageSquare, Save, Sparkles, LoaderCircle } from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_FIREBASE_CONFIG)
  ? JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG)
  : (typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {});

const appId = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_APP_ID)
  ? process.env.REACT_APP_APP_ID
  : (typeof __app_id !== 'undefined' ? __app_id : 'default-habit-garden');

// --- Gemini API Key ---
const GEMINI_API_KEY = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_GEMINI_API_KEY)
  ? process.env.REACT_APP_GEMINI_API_KEY
  : "";

// --- Motivational Sayings ---
const motivationalSayings = [
    "Consistency is the key to success.",
    "A little progress each day adds up to big results.",
    "Discipline is choosing between what you want now and what you want most.",
    "You are what you repeatedly do.",
    "The secret of your future is hidden in your daily routine."
];

// --- Helper Functions ---
const isYesterday = (date) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return date.toDateString() === yesterday.toDateString();
};

// --- Gemini API Helper ---
async function callGemini(prompt) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`API call failed with status: ${response.status}`);
        const result = await response.json();
        if (result.candidates?.[0]?.content?.parts?.[0]) {
            return result.candidates[0].content.parts[0].text;
        }
        return "Sorry, I couldn't come up with anything right now.";
    } catch (error) {
        console.error("Gemini API call error:", error);
        return "Sorry, there was an error connecting to the AI.";
    }
}

// --- Main App Component ---
export default function App() {
    const [db, setDb] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    useEffect(() => {
        try {
            if (Object.keys(firebaseConfig).length > 0) {
                const app = initializeApp(firebaseConfig);
                const authInstance = getAuth(app);
                const dbInstance = getFirestore(app);
                setDb(dbInstance);

                const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
                    if (user) {
                        setUserId(user.uid);
                    } else {
                        await signInAnonymously(authInstance).catch(err => console.error("Anonymous sign-in error:", err));
                    }
                    setIsAuthReady(true);
                });
                 return () => unsubscribe();
            } else {
                 console.error("Firebase config is missing.");
                 setIsAuthReady(true);
            }
        } catch (error) {
            console.error("Firebase initialization error:", error);
        }
    }, []);

    if (!isAuthReady) return <LoadingScreen />;
    if (!db || !userId) return <LoadingScreen message="Connecting to services..." />;

    return (
        <div className="bg-[#EDE6DB] text-gray-800 min-h-screen font-sans flex flex-col items-center p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-2xl mx-auto">
                <Header db={db} userId={userId} />
                <HabitTracker db={db} userId={userId} />
                <LongTermGoals db={db} userId={userId} />
                <DailyCheckIn db={db} userId={userId} />
                <Footer />
            </div>
        </div>
    );
}

// --- UI Components ---

function UserNameModal({ db, userId, onNameSet }) {
    const [name, setName] = useState('');
    const handleSave = async () => {
        if (!name.trim()) return;
        const profileDocRef = doc(db, `/artifacts/${appId}/users/${userId}/profile/main`);
        await setDoc(profileDocRef, { name: name.trim() });
        onNameSet(name.trim());
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#EDE6DB] p-8 rounded-2xl shadow-2xl text-center max-w-sm w-full">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to HabitGarden!</h2>
                <p className="text-gray-600 mb-6">What's your name?</p>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" className="w-full bg-white text-gray-800 placeholder-gray-400 rounded-lg px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-[#A3B18A]" />
                <button onClick={handleSave} className="w-full bg-[#A3B18A] hover:bg-[#8a9a74] text-white font-bold rounded-lg py-3 transition-all duration-200">Get Started</button>
            </div>
        </div>
    );
}

function Header({ db, userId }) {
    const [userName, setUserName] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [saying, setSaying] = useState(motivationalSayings[0]);

    useEffect(() => {
        const profileDocRef = doc(db, `/artifacts/${appId}/users/${userId}/profile/main`);
        const unsubscribe = onSnapshot(profileDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setUserName(docSnap.data().name);
                setShowModal(false);
            } else {
                setShowModal(true);
            }
        });
        return unsubscribe;
    }, [db, userId]);

    useEffect(() => {
        if (!userName) return;
        const interval = setInterval(() => {
            setSaying(prev => motivationalSayings[(motivationalSayings.indexOf(prev) + 1) % motivationalSayings.length]);
        }, 5000);
        return () => clearInterval(interval);
    }, [userName]);

    return (
        <>
            {showModal && <UserNameModal db={db} userId={userId} onNameSet={setUserName} />}
            <header className="mb-8 text-center">
                <div className="flex items-center justify-center gap-3 mb-2">
                    <Sprout className="w-10 h-10 text-[#588157]" />
                    <h1 className="text-5xl font-bold text-gray-800">HabitGarden</h1>
                </div>
                {userName && (
                    <div className="h-12">
                        <h2 className="text-2xl text-gray-700 font-semibold">Hello, {userName}.</h2>
                        <p className="text-gray-500 italic">{saying}</p>
                    </div>
                )}
            </header>
        </>
    );
}

function HabitTracker({ db, userId }) {
    const [habits, setHabits] = useState([]);
    const [filteredHabits, setFilteredHabits] = useState([]);
    const [completedHabits, setCompletedHabits] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [notesHabit, setNotesHabit] = useState(null);

    const todayId = new Date().toISOString().split('T')[0];

    useEffect(() => {
        const habitsCollectionPath = `/artifacts/${appId}/users/${userId}/habits`;
        const q = query(collection(db, habitsCollectionPath));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setHabits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return unsubscribe;
    }, [db, userId]);
    
    useEffect(() => {
        const today = new Date();
        const dayOfWeek = today.getDay(); // Sunday - 0, ... Saturday - 6

        const filtered = habits.filter(habit => {
            const freq = habit.frequency;
            if (freq?.type === 'Weekly') {
                return freq.days.includes(dayOfWeek);
            }
            if (freq?.type === 'Monthly') {
                return today.getDate() === 1;
            }
            return freq?.type === 'Daily' || !freq?.type; // Default to daily
        });
        setFilteredHabits(filtered);
    }, [habits]);

    useEffect(() => {
        const dailyRecordDocPath = `/artifacts/${appId}/users/${userId}/dailyRecords/${todayId}`;
        const docRef = doc(db, dailyRecordDocPath);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            setCompletedHabits(new Set(docSnap.exists() ? docSnap.data().completed || [] : []));
        });
        return unsubscribe;
    }, [db, userId, todayId]);

    const addHabit = async (name, frequency) => {
        if (!name.trim()) return;
        const habitsCollectionPath = `/artifacts/${appId}/users/${userId}/habits`;
        await addDoc(collection(db, habitsCollectionPath), { 
            name: name.trim(), 
            frequency: frequency,
            createdAt: serverTimestamp(),
            currentStreak: 0,
            longestStreak: 0,
            lastCompletedDate: null,
        });
    };

    const updateHabit = async (habitId, newName, newFrequency) => {
        const habitDocRef = doc(db, `/artifacts/${appId}/users/${userId}/habits/${habitId}`);
        await updateDoc(habitDocRef, { name: newName, frequency: newFrequency });
    };

    const deleteHabit = async (habitId) => {
        await deleteDoc(doc(db, `/artifacts/${appId}/users/${userId}/habits/${habitId}`));
        const dailyRecordDocRef = doc(db, `/artifacts/${appId}/users/${userId}/dailyRecords/${todayId}`);
        await updateDoc(dailyRecordDocRef, { completed: arrayRemove(habitId) }).catch(() => {});
    };

    const toggleHabit = async (habitId) => {
        const batch = writeBatch(db);
        const dailyRecordDocRef = doc(db, `/artifacts/${appId}/users/${userId}/dailyRecords/${todayId}`);
        const habitDocRef = doc(db, `/artifacts/${appId}/users/${userId}/habits/${habitId}`);
        
        const isCompleted = completedHabits.has(habitId);
        const habitData = habits.find(h => h.id === habitId);

        if (!isCompleted) {
            batch.set(dailyRecordDocRef, { completed: arrayUnion(habitId) }, { merge: true });
            
            let newStreak = habitData.currentStreak || 0;
            const lastCompleted = habitData.lastCompletedDate?.toDate();
            if (lastCompleted && isYesterday(lastCompleted)) {
                newStreak++;
            } else {
                newStreak = 1;
            }
            
            batch.update(habitDocRef, {
                currentStreak: newStreak,
                longestStreak: Math.max(habitData.longestStreak || 0, newStreak),
                lastCompletedDate: serverTimestamp()
            });

        } else {
            batch.update(dailyRecordDocRef, { completed: arrayRemove(habitId) });
            batch.update(habitDocRef, {
                currentStreak: (habitData.currentStreak || 1) - 1,
                lastCompletedDate: null
            });
        }
        await batch.commit();
    };

    return (
        <main className="bg-white/50 rounded-2xl p-6 shadow-lg border border-[#A3B18A]/30 backdrop-blur-sm mb-8">
            <AddHabitForm onAdd={addHabit} existingHabits={habits} />
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Today's Habits</h2>
            {loading ? <p className="text-center text-gray-500 py-8">Loading habits...</p>
                : habits.length > 0 ? (
                    <HabitList
                        habits={filteredHabits}
                        completedHabits={completedHabits}
                        onToggle={toggleHabit}
                        onDelete={deleteHabit}
                        onUpdate={updateHabit}
                        onNotes={setNotesHabit}
                    />
                ) : <EmptyState />}
            {notesHabit && <NotesModal db={db} userId={userId} habit={notesHabit} dateId={todayId} onClose={() => setNotesHabit(null)} />}
        </main>
    );
}

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function AddHabitForm({ onAdd, existingHabits }) {
    const [name, setName] = useState('');
    const [frequencyType, setFrequencyType] = useState('Daily');
    const [weeklyDays, setWeeklyDays] = useState(new Set());
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [suggestions, setSuggestions] = useState([]);

    const handleDayToggle = (dayIndex) => {
        const newDays = new Set(weeklyDays);
        if (newDays.has(dayIndex)) {
            newDays.delete(dayIndex);
        } else {
            newDays.add(dayIndex);
        }
        setWeeklyDays(newDays);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        let frequency;
        if (frequencyType === 'Weekly') {
            frequency = { type: 'Weekly', days: Array.from(weeklyDays) };
        } else {
            frequency = { type: frequencyType };
        }
        onAdd(name, frequency);
        setName('');
        setFrequencyType('Daily');
        setWeeklyDays(new Set());
        setSuggestions([]);
    };

    const handleSuggest = async () => {
        setIsSuggesting(true);
        setSuggestions([]);
        const prompt = existingHabits.length > 0
            ? `Based on these existing habits: ${existingHabits.map(h => h.name).join(', ')}, suggest 5 new, related habits. Format as a numbered list.`
            : "Suggest 5 simple, positive daily habits for someone just starting out. Format as a numbered list.";
        const result = await callGemini(prompt);
        const ideas = result.split('\n').map(item => item.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
        setSuggestions(ideas);
        setIsSuggesting(false);
    };
    
    const handleSuggestionClick = (suggestion) => {
        onAdd(suggestion, { type: 'Daily' });
        setSuggestions([]);
    };

    return (
        <div className="mb-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-3">
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a new habit..." className="flex-grow bg-white text-gray-800 placeholder-gray-400 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#A3B18A] transition-all" />
                    <div className="flex gap-3">
                        <select value={frequencyType} onChange={(e) => setFrequencyType(e.target.value)} className="bg-white text-gray-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#A3B18A]">
                            <option value="Daily">Daily</option>
                            <option value="Weekly">Weekly</option>
                            <option value="Monthly">Monthly</option>
                        </select>
                        <button type="button" onClick={handleSuggest} disabled={isSuggesting} title="Suggest Habits" className="bg-[#A3B18A] hover:bg-[#8a9a74] text-white font-bold rounded-lg px-4 py-3 flex items-center justify-center transition-all duration-200 transform hover:scale-105 disabled:bg-gray-400">
                            {isSuggesting ? <LoaderCircle className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                        </button>
                        <button type="submit" className="bg-[#A3B18A] hover:bg-[#8a9a74] text-white font-bold rounded-lg px-4 py-3 flex items-center justify-center transition-all duration-200 transform hover:scale-105 disabled:bg-gray-400" disabled={!name.trim() || (frequencyType === 'Weekly' && weeklyDays.size === 0)}><Plus className="w-6 h-6" /></button>
                    </div>
                </div>
                {frequencyType === 'Weekly' && (
                    <div className="flex justify-center gap-2 bg-white/50 p-2 rounded-lg">
                        {daysOfWeek.map((day, index) => (
                            <button key={day} type="button" onClick={() => handleDayToggle(index)} className={`px-3 py-1 rounded-full text-sm font-semibold transition-colors ${weeklyDays.has(index) ? 'bg-[#588157] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                                {day}
                            </button>
                        ))}
                    </div>
                )}
            </form>
            {suggestions.length > 0 && (
                <div className="mt-3 bg-white/80 p-3 rounded-lg space-y-2">
                    <h3 className="font-bold text-sm text-gray-600">Suggestions:</h3>
                    {suggestions.map((s, i) => <p key={i} onClick={() => handleSuggestionClick(s)} className="cursor-pointer p-2 rounded-md hover:bg-[#A3B18A]/30">{s}</p>)}
                </div>
            )}
        </div>
    );
}

function HabitList({ habits, completedHabits, onToggle, onDelete, onUpdate, onNotes }) {
    if (habits.length === 0) {
        return <p className="text-center text-gray-500 py-8">No habits scheduled for today.</p>;
    }
    return (
        <div className="space-y-3">
            {habits.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)).map(habit => (
                <HabitItem key={habit.id} habit={habit} isCompleted={completedHabits.has(habit.id)} onToggle={() => onToggle(habit.id)} onDelete={() => onDelete(habit.id)} onUpdate={onUpdate} onNotes={() => onNotes(habit)} />
            ))}
        </div>
    );
}

function HabitItem({ habit, isCompleted, onToggle, onDelete, onUpdate, onNotes }) {
    const [isAnimating, setIsAnimating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(habit.name);
    const [editFrequencyType, setEditFrequencyType] = useState(habit.frequency?.type || 'Daily');
    const [editWeeklyDays, setEditWeeklyDays] = useState(new Set(habit.frequency?.type === 'Weekly' ? habit.frequency.days : []));

    const handleToggle = () => {
        if (!isCompleted) {
            setIsAnimating(true);
            setTimeout(() => setIsAnimating(false), 2000);
        }
        onToggle();
    };

    const handleUpdate = () => {
        let newFrequency;
        if (editFrequencyType === 'Weekly') {
            newFrequency = { type: 'Weekly', days: Array.from(editWeeklyDays) };
        } else {
            newFrequency = { type: editFrequencyType };
        }
        onUpdate(habit.id, editName, newFrequency);
        setIsEditing(false);
    };

    const handleDayToggle = (dayIndex) => {
        const newDays = new Set(editWeeklyDays);
        if (newDays.has(dayIndex)) newDays.delete(dayIndex);
        else newDays.add(dayIndex);
        setEditWeeklyDays(newDays);
    };

    if (isEditing) {
        return (
            <div className="bg-white/60 p-4 rounded-lg space-y-3">
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-white text-gray-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#A3B18A]" />
                <select value={editFrequencyType} onChange={(e) => setEditFrequencyType(e.target.value)} className="w-full bg-white text-gray-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#A3B18A]">
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                </select>
                {editFrequencyType === 'Weekly' && (
                    <div className="flex justify-center gap-1 bg-white/50 p-2 rounded-lg">
                        {daysOfWeek.map((day, index) => (
                            <button key={day} type="button" onClick={() => handleDayToggle(index)} className={`px-2 py-1 rounded-full text-xs font-semibold transition-colors ${editWeeklyDays.has(index) ? 'bg-[#588157] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                                {day}
                            </button>
                        ))}
                    </div>
                )}
                <div className="flex justify-end gap-2">
                    <button onClick={() => setIsEditing(false)} className="px-3 py-1 bg-gray-300 text-gray-800 rounded-md">Cancel</button>
                    <button onClick={handleUpdate} className="px-3 py-1 bg-[#A3B18A] text-white rounded-md flex items-center gap-1"><Save size={16} /> Save</button>
                </div>
            </div>
        );
    }

    return (
        <div className="relative group">
             {isAnimating && <Confetti />}
            <div className={`flex items-center p-4 rounded-lg transition-all duration-300 ${isCompleted ? 'bg-[#A3B18A]/30' : 'bg-white/40 hover:bg-white/80'}`}>
                <button onClick={handleToggle} className="flex-shrink-0 mr-4"><_Icon isCompleted={isCompleted} /></button>
                <div className="flex-grow flex items-center">
                    <div>
                        <span className={`text-lg ${isCompleted ? 'line-through text-gray-500' : 'text-gray-800'}`}>{habit.name}</span>
                        <span className="ml-2 text-xs bg-gray-300 text-gray-700 px-2 py-1 rounded-full">{habit.frequency?.type || 'Daily'}</span>
                    </div>
                    {habit.currentStreak > 0 && (
                        <span className="ml-3 flex items-center text-sm text-orange-600 font-semibold"><Flame size={16} className="mr-1" /> {habit.currentStreak}</span>
                    )}
                </div>
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={onNotes} title="Add Note" className="ml-4 text-gray-500 hover:text-blue-500"><MessageSquare className="w-5 h-5" /></button>
                    <button onClick={() => setIsEditing(true)} title="Edit habit" className="ml-4 text-gray-500 hover:text-green-600"><Edit className="w-5 h-5" /></button>
                    <button onClick={onDelete} title="Delete habit" className="ml-4 text-gray-500 hover:text-red-500"><Trash2 className="w-5 h-5" /></button>
                </div>
            </div>
            {isAnimating && <WateringCan />}
        </div>
    );
}

function NotesModal({ db, userId, habit, dateId, onClose }) {
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(true);

    const dailyRecordDocRef = doc(db, `/artifacts/${appId}/users/${userId}/dailyRecords/${dateId}`);

    useEffect(() => {
        getDoc(dailyRecordDocRef).then(docSnap => {
            if (docSnap.exists()) {
                setNote(docSnap.data().notes?.[habit.id] || '');
            }
            setLoading(false);
        });
    }, [dailyRecordDocRef, habit.id]);

    const handleSave = async () => {
        await setDoc(dailyRecordDocRef, {
            notes: {
                [habit.id]: note
            }
        }, { merge: true });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-[#EDE6DB] p-8 rounded-2xl shadow-2xl max-w-md w-full relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X /></button>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Note for: <span className="text-[#588157]">{habit.name}</span></h2>
                {loading ? <p>Loading...</p> : (
                    <>
                        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows="4" className="w-full bg-white p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-[#A3B18A]" placeholder="Add your thoughts..."></textarea>
                        <button onClick={handleSave} className="mt-4 w-full bg-[#A3B18A] text-white py-2 rounded-md">Save Note</button>
                    </>
                )}
            </div>
        </div>
    );
}

function LongTermGoals({ db, userId }) {
    const [goals, setGoals] = useState([]);
    const [newGoal, setNewGoal] = useState('');

    useEffect(() => {
        const goalsCollectionPath = `/artifacts/${appId}/users/${userId}/goals`;
        const q = query(collection(db, goalsCollectionPath));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setGoals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return unsubscribe;
    }, [db, userId]);

    const addGoal = async (e) => {
        e.preventDefault();
        if (!newGoal.trim()) return;
        const goalsCollectionPath = `/artifacts/${appId}/users/${userId}/goals`;
        await addDoc(collection(db, goalsCollectionPath), { text: newGoal.trim(), createdAt: serverTimestamp() });
        setNewGoal('');
    };

    const deleteGoal = async (goalId) => {
        await deleteDoc(doc(db, `/artifacts/${appId}/users/${userId}/goals/${goalId}`));
    };

    return (
        <section className="bg-white/50 rounded-2xl p-6 shadow-lg border border-[#A3B18A]/30 backdrop-blur-sm">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2"><Target /> Long Term Goals</h2>
            <form onSubmit={addGoal} className="flex gap-3 mb-4">
                <input type="text" value={newGoal} onChange={(e) => setNewGoal(e.target.value)} placeholder="e.g., Run a marathon" className="flex-grow bg-white text-gray-800 placeholder-gray-400 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#A3B18A]" />
                <button type="submit" className="bg-[#A3B18A] hover:bg-[#8a9a74] text-white font-bold rounded-lg px-4 py-3 disabled:bg-gray-400" disabled={!newGoal.trim()}><Plus /></button>
            </form>
            <div className="space-y-2">
                {goals.length > 0 ? goals.map(goal => (
                    <div key={goal.id} className="flex items-center bg-white/40 p-3 rounded-lg">
                        <p className="flex-grow text-gray-700">{goal.text}</p>
                        <button onClick={() => deleteGoal(goal.id)} className="text-gray-500 hover:text-red-500"><Trash2 size={18} /></button>
                    </div>
                )) : <p className="text-center text-gray-500 py-4">No long term goals set yet.</p>}
            </div>
        </section>
    );
}

function DailyCheckIn({ db, userId }) {
    const [showCheckIn, setShowCheckIn] = useState(false);
    const todayId = new Date().toISOString().split('T')[0];

    useEffect(() => {
        const checkInDocRef = doc(db, `/artifacts/${appId}/users/${userId}/checkIns/${todayId}`);
        getDoc(checkInDocRef).then(docSnap => {
            if (!docSnap.exists()) {
                setShowCheckIn(true);
            }
        });
    }, [db, userId, todayId]);

    const handleCheckIn = async (mood) => {
        const checkInDocRef = doc(db, `/artifacts/${appId}/users/${userId}/checkIns/${todayId}`);
        await setDoc(checkInDocRef, { mood, createdAt: serverTimestamp() });
        setShowCheckIn(false);
    };

    if (!showCheckIn) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#EDE6DB] p-8 rounded-2xl shadow-2xl text-center max-w-sm w-full">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Daily Check-in</h2>
                <p className="text-gray-600 mb-6">How are you feeling about your progress today?</p>
                <div className="flex justify-center gap-4">
                    <button onClick={() => handleCheckIn('Great')} className="text-4xl hover:scale-125 transition-transform">😊</button>
                    <button onClick={() => handleCheckIn('Okay')} className="text-4xl hover:scale-125 transition-transform">😐</button>
                    <button onClick={() => handleCheckIn('Could be better')} className="text-4xl hover:scale-125 transition-transform">😕</button>
                </div>
            </div>
        </div>
    );
}


const _Icon = ({ isCompleted }) => isCompleted ? <CheckCircle className="w-7 h-7 text-green-600" /> : <Circle className="w-7 h-7 text-gray-400" />;

function WateringCan() {
    return (<svg viewBox="0 0 100 80" className="w-12 h-12 absolute -top-4 -right-4 text-[#A3B18A] animate-pour"><style>{`@keyframes pour{0%{transform:rotate(0deg)}30%{transform:rotate(-35deg)}70%{transform:rotate(-35deg)}100%{transform:rotate(0deg);opacity:0}}.animate-pour{animation:pour 1.5s ease-in-out forwards}`}</style><path d="M84.9,43.2c-2.3-11.5-12.7-20.1-24.9-20.1c-1.1,0-2.2,0.1-3.3,0.2c-2-10.9-11.8-19.1-23.4-19.1c-13.2,0-23.9,10.7-23.9,23.9c0,1.3,0.1,2.6,0.3,3.8C4.3,34.2,0,39.6,0,45.9c0,6.9,5.6,12.5,12.5,12.5h17.3c-0.2-0.8-0.3-1.6-0.3-2.5c0-6.9,5.6-12.5,12.5-12.5s12.5,5.6,12.5,12.5c0,0.9-0.1,1.7-0.3,2.5h27.3c6.9,0,12.5-5.6,12.5-12.5C97.1,49.2,91.8,43.8,84.9,43.2z" fill="currentColor" transform="translate(0, 20) scale(0.8)"/><path d="M60,65 h25 a10,10 0 0 1 10,10 v10 a10,10 0 0 1 -10,10 h-25 a0,0 0 0 1 0,0 v-30 a0,0 0 0 1 0,0 z" fill="currentColor"/><rect x="5" y="65" width="60" height="30" rx="5" fill="currentColor"/></svg>);
}

function Confetti() {
    return Array.from({ length: 30 }).map((_, i) => {
        const style = {
            left: `${Math.random() * 100}%`,
            animationDuration: `${Math.random() * 1 + 0.5}s`,
            animationDelay: `${Math.random() * 0.5}s`,
            backgroundColor: ['#A3B18A', '#588157', '#3a5a40', '#dad7cd'][Math.floor(Math.random() * 4)]
        };
        return <div key={i} className="confetti" style={style}></div>;
    });
}

function EmptyState() {
    return (<div className="text-center py-12 px-6 border-2 border-dashed border-[#A3B18A]/50 rounded-lg"><h3 className="text-xl font-semibold text-gray-700">No habits added yet.</h3><p className="text-gray-600 mt-2">Add your first habit above to get started.</p></div>);
}

function LoadingScreen({ message = "Loading your habits..." }) {
    return (<div className="flex flex-col items-center justify-center min-h-screen bg-[#EDE6DB]"><Sprout className="w-16 h-16 text-[#A3B18A] animate-pulse" /><p className="text-gray-800 text-xl mt-4">{message}</p></div>);
}

function Footer() {
    return (<footer className="text-center mt-12"><p className="text-gray-500 text-sm">Powered by React, Firebase & Gemini.</p></footer>);
}

// Add some CSS for the confetti animation
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = `
.confetti {
    position: absolute;
    width: 8px;
    height: 16px;
    top: -20px;
    opacity: 0;
    animation: fall 2s ease-in-out forwards;
}

@keyframes fall {
    0% {
        transform: translateY(0) rotate(0deg);
        opacity: 1;
    }
    100% {
        transform: translateY(100px) rotate(360deg);
        opacity: 0;
    }
}
`;
document.head.appendChild(styleSheet);