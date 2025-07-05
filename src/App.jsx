import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  query,
  onSnapshot,
  addDoc,
  deleteDoc,
  updateDoc,
  getDoc,
} from 'firebase/firestore';
import {
  PlusCircle,
  Brain,
  BookOpen,
  Trash2,
  Edit,
  PlayCircle,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  CalendarDays,
  AlertCircle,
  LayoutDashboard,
  LogIn,
  UserPlus,
  LogOut,
} from 'lucide-react';

// --- Main App Component ---
const App = () => {
  // State variables for Firebase and user data
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [decks, setDecks] = useState([]);
  const [selectedDeck, setSelectedDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [newDeckName, setNewDeckName] = useState('');
  const [newCardFront, setNewCardFront] = useState('');
  const [newCardBack, setNewCardBack] = useState('');
  const [isAddingDeck, setIsAddingDeck] = useState(false);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [isGeneratingAIContent, setIsGeneratingAIContent] = useState(false);

  // New state variables for AI content generation input
  const [aiSubject, setAiSubject] = useState('');
  const [aiRelatedTopics, setAiRelatedTopics] = useState('');
  const [numberOfCardsToGenerate, setNumberOfCardsToGenerate] = useState(1);

  // Spaced Repetition / Review Session States
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewCards, setReviewCards] = useState([]);
  const [currentReviewCardIndex, setCurrentReviewCardIndex] = useState(0);

  // User progress tracking (per selected deck)
  const [dueCardsCount, setDueCardsCount] = useState(0);
  const [learnedCardsCount, setLearnedCardsCount] = useState(0);

  // Overall app progress (for Dashboard)
  const [showDashboard, setShowDashboard] = useState(false);
  const [allDeckCards, setAllDeckCards] = useState({});
  const [totalDecksOverall, setTotalDecksOverall] = useState(0);
  const [totalCardsOverall, setTotalCardsOverall] = useState(0);
  const [totalDueCardsOverall, setTotalDueCardsOverall] = useState(0);
  const [totalLearnedCardsOverall, setTotalLearnedCardsOverall] = useState(0);

  // New state for current page/view (for routing/conditional rendering)
  const [currentPage, setCurrentPage] = useState('home');
  const [authError, setAuthError] = useState('');

  // --- IMPORTANT: Firebase project configuration ---
  const localFirebaseConfig = {
    apiKey:
      typeof import.meta !== 'undefined' &&
      import.meta.env &&
      import.meta.env.VITE_FIREBASE_API_KEY
        ? import.meta.env.VITE_FIREBASE_API_KEY
        : 'YOUR_FIREBASE_WEB_API_KEY_HERE',
    authDomain:
      typeof import.meta !== 'undefined' &&
      import.meta.env &&
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
        ? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
        : 'YOUR_FIREBASE_AUTH_DOMAIN_HERE',
    projectId:
      typeof import.meta !== 'undefined' &&
      import.meta.env &&
      import.meta.env.VITE_FIREBASE_PROJECT_ID
        ? import.meta.env.VITE_FIREBASE_PROJECT_ID
        : 'YOUR_FIREBASE_PROJECT_ID_HERE',
    storageBucket:
      typeof import.meta !== 'undefined' &&
      import.meta.env &&
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET
        ? import.meta.env.VITE_FIREBASE_STORAGE_BUCKET
        : 'YOUR_FIREBASE_STORAGE_BUCKET_HERE',
    messagingSenderId:
      typeof import.meta !== 'undefined' &&
      import.meta.env &&
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
        ? import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
        : 'YOUR_FIREBASE_MESSAGING_SENDER_ID_HERE',
    appId:
      typeof import.meta !== 'undefined' &&
      import.meta.env &&
      import.meta.env.VITE_FIREBASE_APP_ID
        ? import.meta.env.VITE_FIREBASE_APP_ID
        : 'YOUR_FIREBASE_APP_ID_HERE',
  };

  // Firebase Initialization and Authentication
  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        const firebaseConfigToUse =
          typeof __firebase_config !== 'undefined' && __firebase_config
            ? JSON.parse(__firebase_config)
            : localFirebaseConfig;

        const currentAppId =
          typeof __app_id !== 'undefined' && __app_id
            ? __app_id
            : 'flashcard-app';

        console.log('Firebase config being used:', firebaseConfigToUse);
        console.log(
          'Keys in Firebase config:',
          Object.keys(firebaseConfigToUse).length
        );

        const isLocalConfigValid = Object.values(localFirebaseConfig).every(
          (value) =>
            value !== undefined &&
            value !== null &&
            value !== '' &&
            !String(value).startsWith('YOUR_')
        );

        if (
          !firebaseConfigToUse ||
          Object.keys(firebaseConfigToUse).length < 6 ||
          (typeof __firebase_config === 'undefined' && !isLocalConfigValid)
        ) {
          console.error(
            'Firebase config is missing or incomplete. Please ensure your .env.local file has all VITE_FIREBASE_ variables set and updated with actual keys.'
          );
          console.error('Current config state:', firebaseConfigToUse);
          setLoading(false);
          return;
        }

        const app = initializeApp(firebaseConfigToUse);
        const firestoreDb = getFirestore(app);
        const firebaseAuth = getAuth(app);

        setDb(firestoreDb);
        setAuth(firebaseAuth);

        // Handle initial authentication for Canvas environment or local anonymous fallback
        try {
          const initialAuthToken =
            typeof __initial_auth_token !== 'undefined'
              ? __initial_auth_token
              : null;
          if (initialAuthToken) {
            await signInWithCustomToken(firebaseAuth, initialAuthToken);
            console.log('Signed in with custom token (Canvas environment).');
          } else {
            // Only sign in anonymously if no user is currently authenticated
            // This prevents re-signing in anonymously after an explicit logout
            if (!firebaseAuth.currentUser) {
              await signInAnonymously(firebaseAuth);
              console.log(
                'Signed in anonymously (for local/unauthenticated use).'
              );
            }
          }
        } catch (error) {
          console.error(
            'Initial Firebase authentication attempt failed:',
            error.code,
            error.message
          );
          // If initial anonymous sign-in fails, the app will just start unauthenticated.
        }

        // Listen for subsequent authentication state changes (e.g., explicit login/logout)
        const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
          if (user) {
            setUserId(user.uid);
            console.log('User state changed: Signed in as', user.uid);
            // Navigate to dashboard if coming from an auth page or home
            if (
              currentPage === 'login' ||
              currentPage === 'signup' ||
              currentPage === 'home'
            ) {
              setCurrentPage('dashboard');
            }
          } else {
            setUserId(null);
            console.log('User state changed: Signed out.');
            // If explicitly logged out, ensure we are on a public page
            if (
              currentPage !== 'login' &&
              currentPage !== 'signup' &&
              currentPage !== 'home'
            ) {
              setCurrentPage('home'); // Redirect to home if they were on a protected page
            }
          }
          setLoading(false); // Set loading to false once initial auth state is determined
        });

        window.currentAppId = currentAppId;

        return () => unsubscribe(); // Cleanup listener on unmount
      } catch (error) {
        console.error('Error initializing Firebase:', error);
        setLoading(false);
      }
    };

    initializeFirebase();
  }, []); // Empty dependency array means this runs once on mount

  // Effect to fetch decks when db or userId changes
  useEffect(() => {
    if (db && userId && window.currentAppId) {
      const decksCollectionRef = collection(
        db,
        `artifacts/${window.currentAppId}/users/${userId}/decks`
      );
      const q = query(decksCollectionRef);

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const fetchedDecks = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setDecks(fetchedDecks);
          console.log('Decks fetched:', fetchedDecks);
        },
        (error) => {
          console.error('Error fetching decks:', error);
        }
      );

      return () => unsubscribe();
    }
  }, [db, userId]);

  // NEW EFFECT: Synchronize selectedDeck with the latest data from 'decks'
  useEffect(() => {
    if (selectedDeck && decks.length > 0) {
      const updatedSelectedDeck = decks.find(
        (deck) => deck.id === selectedDeck.id
      );
      if (
        updatedSelectedDeck &&
        updatedSelectedDeck.cardCount !== selectedDeck.cardCount
      ) {
        setSelectedDeck(updatedSelectedDeck);
        console.log(
          'Selected deck updated with latest card count:',
          updatedSelectedDeck.cardCount
        );
      }
    }
  }, [decks, selectedDeck]);

  // Effect to fetch cards when selectedDeck changes
  useEffect(() => {
    if (db && userId && selectedDeck && window.currentAppId) {
      const cardsCollectionRef = collection(
        db,
        `artifacts/${window.currentAppId}/users/${userId}/decks/${selectedDeck.id}/cards`
      );
      const q = query(cardsCollectionRef);

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const fetchedCards = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setCards(fetchedCards);
          console.log(
            'Cards fetched for deck:',
            selectedDeck.name,
            fetchedCards
          );
        },
        (error) => {
          console.error('Error fetching cards:', error);
        }
      );

      return () => unsubscribe();
    } else {
      setCards([]);
    }
  }, [db, userId, selectedDeck]);

  // Effect to calculate and update user progress metrics (per selected deck)
  useEffect(() => {
    if (cards.length > 0) {
      const currentTime = new Date();

      const dueToday = cards.filter((card) => {
        const nextReview = new Date(card.nextReviewDate);
        return nextReview <= currentTime;
      }).length;

      const learned = cards.filter((card) => card.repetitions > 0).length;

      setDueCardsCount(dueToday);
      setLearnedCardsCount(learned);
      console.log(
        `Progress Update (Selected Deck): Due Today: ${dueToday}, Cards Learned: ${learned}`
      );
    } else {
      setDueCardsCount(0);
      setLearnedCardsCount(0);
      console.log(
        'Progress Update (Selected Deck): No cards, counts reset to 0.'
      );
    }
  }, [cards]);

  // NEW EFFECT: Fetch all cards for overall dashboard statistics
  useEffect(() => {
    if (db && userId && window.currentAppId && decks.length > 0) {
      const unsubscribeListeners = [];
      const newAllDeckCards = {};

      setTotalDecksOverall(decks.length);
      setTotalCardsOverall(
        decks.reduce((sum, deck) => sum + (deck.cardCount || 0), 0)
      );

      decks.forEach((deck) => {
        const cardsCollectionRef = collection(
          db,
          `artifacts/${window.currentAppId}/users/${userId}/decks/${deck.id}/cards`
        );
        const q = query(cardsCollectionRef);

        const unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const fetchedCardsForDeck = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            newAllDeckCards[deck.id] = fetchedCardsForDeck;
            setAllDeckCards({ ...newAllDeckCards });

            const currentAllCards = Object.values(newAllDeckCards).flat();
            const currentTime = new Date();

            const overallDue = currentAllCards.filter((card) => {
              const nextReview = new Date(card.nextReviewDate);
              return nextReview <= currentTime;
            }).length;

            const overallLearned = currentAllCards.filter(
              (card) => card.repetitions > 0
            ).length;

            setTotalDueCardsOverall(overallDue);
            setTotalLearnedCardsOverall(overallLearned);
            console.log(
              `Overall Progress Update: Total Due: ${overallDue}, Total Learned: ${overallLearned}`
            );
          },
          (error) => {
            console.error(`Error fetching cards for deck ${deck.id}:`, error);
          }
        );
        unsubscribeListeners.push(unsubscribe);
      });

      return () => {
        unsubscribeListeners.forEach((unsubscribe) => unsubscribe());
      };
    } else if (decks.length === 0) {
      setAllDeckCards({});
      setTotalDecksOverall(0);
      setTotalCardsOverall(0);
      setTotalDueCardsOverall(0);
      setTotalLearnedCardsOverall(0);
    }
  }, [db, userId, decks]);

  // Effect to log isAddingDeck state changes
  useEffect(() => {
    console.log('isAddingDeck state is now:', isAddingDeck);
  }, [isAddingDeck]);

  // Function to add a new deck to Firestore
  const addDeck = async () => {
    console.log('addDeck function called.'); // Debugging log
    console.log('newDeckName value:', newDeckName); // Debugging log
    if (!newDeckName.trim()) {
      console.warn('Deck name cannot be empty!');
      setAuthError('Deck name cannot be empty!'); // User-facing message
      setIsAddingDeck(false); // Close modal even if validation fails
      return;
    }
    if (!db || !userId || !window.currentAppId) {
      console.error(
        'Cannot add deck: Firebase DB, User ID, or App ID not available.'
      );
      setAuthError(
        'Cannot add deck: Please ensure you are logged in and the app is initialized.'
      );
      setIsAddingDeck(false); // Close modal on critical error
      return;
    }
    try {
      await addDoc(
        collection(
          db,
          `artifacts/${window.currentAppId}/users/${userId}/decks`
        ),
        {
          name: newDeckName,
          cardCount: 0,
          createdAt: new Date().toISOString(),
        }
      );
      setNewDeckName('');
      setIsAddingDeck(false);
      setAuthError(''); // Clear any previous errors
      console.log('Deck added successfully!');
    } catch (e) {
      console.error('Error adding document: ', e);
      setAuthError(`Error adding deck: ${e.message}`);
      setIsAddingDeck(false); // Close modal on error
    }
  };

  // Function to add a new card to the currently selected deck in Firestore
  const addCard = async (cardData) => {
    if (!db || !userId || !selectedDeck || !window.currentAppId) return;
    try {
      await addDoc(
        collection(
          db,
          `artifacts/${window.currentAppId}/users/${userId}/decks/${selectedDeck.id}/cards`
        ),
        {
          front: cardData.front,
          back: cardData.back,
          easeFactor: 2.5,
          interval: 0,
          repetitions: 0,
          nextReviewDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        }
      );

      const deckRef = doc(
        db,
        `artifacts/${window.currentAppId}/users/${userId}/decks`,
        selectedDeck.id
      );
      const deckSnap = await getDoc(deckRef);
      if (deckSnap.exists()) {
        const currentCardCount = deckSnap.data().cardCount || 0;
        await updateDoc(deckRef, {
          cardCount: currentCardCount + 1,
        });
      } else {
        console.warn(
          'Deck document not found when trying to increment card count.'
        );
      }

      console.log('Card added successfully!');
    } catch (e) {
      console.error('Error adding card: ', e);
    }
  };

  // Function to delete a card from Firestore
  const deleteCard = async (cardId) => {
    if (!db || !userId || !selectedDeck || !window.currentAppId) return;
    try {
      await deleteDoc(
        doc(
          db,
          `artifacts/${window.currentAppId}/users/${userId}/decks/${selectedDeck.id}/cards`,
          cardId
        )
      );

      const deckRef = doc(
        db,
        `artifacts/${window.currentAppId}/users/${userId}/decks`,
        selectedDeck.id
      );
      const deckSnap = await getDoc(deckRef);
      if (deckSnap.exists()) {
        const currentCardCount = deckSnap.data().cardCount || 0;
        await updateDoc(deckRef, {
          cardCount: Math.max(0, currentCardCount - 1),
        });
      } else {
        console.warn(
          'Deck document not found when trying to decrement card count.'
        );
      }

      console.log('Card deleted successfully!');
    } catch (e) {
      console.error('Error deleting card: ', e);
    }
  };

  // Function to set the card to be edited in the modal
  const startEditCard = (card) => {
    setEditingCard(card);
    setNewCardFront(card.front);
    setNewCardBack(card.back);
    setAiSubject('');
    setAiRelatedTopics('');
    setNumberOfCardsToGenerate(1);
  };

  // Function to update an existing card in Firestore
  const updateCard = async () => {
    if (
      !editingCard ||
      !newCardFront.trim() ||
      !newCardBack.trim() ||
      !db ||
      !userId ||
      !selectedDeck ||
      !window.currentAppId
    )
      return;
    try {
      const cardRef = doc(
        db,
        `artifacts/${window.currentAppId}/users/${userId}/decks/${selectedDeck.id}/cards`,
        editingCard.id
      );
      await updateDoc(cardRef, {
        front: newCardFront,
        back: newCardBack,
        updatedAt: new Date().toISOString(),
      });
      setEditingCard(null);
      setNewCardFront('');
      setNewCardBack('');
      console.log('Card updated successfully!');
    } catch (e) {
      console.error('Error updating card: ', e);
    }
  };

  // Function for AI content generation
  const generateCardContentWithAI = async () => {
    setIsGeneratingAIContent(true);
    try {
      const existingCardContext = cards
        .slice(-5)
        .map((card) => `Q: ${card.front}\nA: ${card.back}`)
        .join('\n---\n');

      let contextPrompt = '';
      if (existingCardContext) {
        contextPrompt = `Consider the following existing flashcards from this deck to generate new, related, but not identical, content:\n${existingCardContext}\n---\n`;
      }

      const promptText = `Generate ${numberOfCardsToGenerate} flashcard questions and answers.
      ${contextPrompt}
      ${aiSubject ? `Subject: ${aiSubject}.` : ''}
      ${aiRelatedTopics ? `Related topics/keywords: ${aiRelatedTopics}.` : ''}
      Ensure each question is concise and its answer is informative.
      Format the response as a JSON array of objects, where each object has two keys: "question" (string) and "answer" (string).
      Example: [{"question": "Q1", "answer": "A1"}, {"question": "Q2", "answer": "A2"}]`;

      let chatHistory = [];
      chatHistory.push({ role: 'user', parts: [{ text: promptText }] });

      const payload = {
        contents: chatHistory,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                question: { type: 'STRING' },
                answer: { type: 'STRING' },
              },
              propertyOrdering: ['question', 'answer'],
            },
          },
        },
      };

      const apiKey =
        typeof import.meta !== 'undefined' &&
        import.meta.env &&
        import.meta.env.VITE_GEMINI_API_KEY
          ? import.meta.env.VITE_GEMINI_API_KEY
          : '';
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      console.log(
        'API Key before fetch:',
        apiKey
          ? 'Provided (from local .env or Canvas)'
          : 'Not Provided (Expected in Canvas)'
      );

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (
        result.candidates &&
        result.candidates.length > 0 &&
        result.candidates[0].content &&
        result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0
      ) {
        const aiText = result.candidates[0].content.parts[0].text;
        const parsedContent = JSON.parse(aiText);

        if (Array.isArray(parsedContent) && parsedContent.length > 0) {
          for (const card of parsedContent) {
            if (card.question && card.answer) {
              await addCard({ front: card.question, back: card.answer });
            }
          }
          setNewCardFront(parsedContent[0].question || '');
          setNewCardBack(parsedContent[0].answer || '');
          console.log('AI content generated and added successfully!');
        } else {
          console.error(
            'AI did not return a valid array of cards:',
            parsedContent
          );
          setNewCardFront('AI Generated Question (Failed)');
          setNewCardBack('AI Generated Answer (Failed)');
        }
      } else {
        console.error('AI did not return valid content:', result);
        setNewCardFront('AI Generated Question (Failed)');
        setNewCardBack('AI Generated Answer (Failed)');
      }
    } catch (e) {
      console.error('Error generating AI content: ', e);
      setNewCardFront('AI Generation Failed');
      setNewCardBack('Please try again or enter manually.');
    } finally {
      setIsGeneratingAIContent(false);
    }
  };

  // --- Spaced Repetition Logic ---
  const startReviewSession = () => {
    console.log('Attempting to start review session.');
    if (!selectedDeck || cards.length === 0) {
      console.log('No cards in this deck to review or no deck selected.');
      return;
    }

    const now = new Date();
    const dueCards = cards.filter((card) => {
      const nextReview = new Date(card.nextReviewDate);
      return nextReview <= now;
    });

    dueCards.sort(
      (a, b) => new Date(a.nextReviewDate) - new Date(b.nextReviewDate)
    );

    console.log(
      'Due cards found for review session:',
      dueCards.length,
      dueCards
    );

    if (dueCards.length === 0) {
      console.log('No cards due for review in this deck.');
      return;
    }

    console.log(
      'Setting reviewMode to true, currentReviewCardIndex to 0, reviewCards array:',
      dueCards
    );
    setReviewCards(dueCards);
    setCurrentReviewCardIndex(0);
    setReviewMode(true);
    console.log('Starting review session with', dueCards.length, 'cards.');
  };

  const calculateNextReview = (card, quality) => {
    let { repetitions, interval, easeFactor } = card;

    if (quality === 0) {
      repetitions = 0;
      interval = 0;
      easeFactor = easeFactor - 0.2;
    } else if (quality >= 3) {
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetitions++;
    } else {
      repetitions = 0;
      interval = 1;
    }

    if (quality > 0) {
      easeFactor =
        easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    }
    if (easeFactor < 1.3) {
      easeFactor = 1.3;
    }

    const nextReviewDate = new Date();
    if (interval === 0) {
      nextReviewDate.setMinutes(nextReviewDate.getMinutes() + 5);
    } else {
      nextReviewDate.setDate(nextReviewDate.getDate() + interval);
    }

    console.log(
      `Calculated next review for card "${
        card.front
      }": repetitions=${repetitions}, interval=${interval}, easeFactor=${easeFactor}, nextReviewDate=${nextReviewDate.toISOString()}`
    );

    return {
      repetitions,
      interval,
      easeFactor,
      nextReviewDate: nextReviewDate.toISOString(),
    };
  };

  const handleReview = async (card, quality) => {
    console.log(
      'Handling review for card:',
      card.front,
      'with quality:',
      quality
    );
    console.log(
      'Current index:',
      currentReviewCardIndex,
      'Total review cards:',
      reviewCards.length
    );

    if (!db || !userId || !selectedDeck || !window.currentAppId) return;

    const updatedCardData = calculateNextReview(card, quality);

    try {
      const cardRef = doc(
        db,
        `artifacts/${window.currentAppId}/users/${userId}/decks/${selectedDeck.id}/cards`,
        card.id
      );
      await updateDoc(cardRef, updatedCardData);
      console.log(
        `Card "${card.front}" reviewed with quality ${quality}. Next review: ${updatedCardData.nextReviewDate}`
      );

      if (currentReviewCardIndex < reviewCards.length - 1) {
        setCurrentReviewCardIndex((prevIndex) => prevIndex + 1);
      } else {
        console.log('Last card reviewed. Ending session.');
        setReviewMode(false);
        setReviewCards([]);
        setCurrentReviewCardIndex(0);
        console.log('Review session completed!');
      }
    } catch (e) {
      console.error('Error updating card after review: ', e);
    }
  };

  // --- Authentication Functions ---
  const handleSignUp = async (email, password) => {
    setAuthError('');
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      console.log('User signed up successfully!');
      setCurrentPage('dashboard'); // Navigate to dashboard after signup
    } catch (error) {
      console.error('Error signing up:', error.code, error.message);
      if (error.code === 'auth/operation-not-allowed') {
        setAuthError(
          'Email/Password authentication is not enabled. Please enable it in your Firebase project settings (Authentication -> Sign-in method).'
        );
      } else {
        setAuthError(error.message);
      }
    }
  };

  const handleLogin = async (email, password) => {
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log('User logged in successfully!');
      setCurrentPage('dashboard'); // Navigate to dashboard after login
    } catch (error) {
      console.error('Error logging in:', error.code, error.message);
      if (error.code === 'auth/operation-not-allowed') {
        setAuthError(
          'Email/Password authentication is not enabled. Please enable it in your Firebase project settings (Authentication -> Sign-in method).'
        );
      } else if (error.code === 'auth/invalid-credential') {
        setAuthError(
          'Invalid email or password. Please check your credentials.'
        );
      } else {
        setAuthError(error.message);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      console.log('User logged out successfully!');
      setCurrentPage('home'); // Go to home page after logout
    } catch (error) {
      console.error('Error logging out:', error.code, error.message);
      setAuthError(error.message);
    }
  };

  // Show a loading screen while Firebase initializes
  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100'>
        <div className='text-xl font-semibold'>Loading App...</div>
      </div>
    );
  }

  // --- Main Application UI ---
  return (
    <div className='min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-inter flex flex-col items-center p-4 sm:p-6 md:p-8'>
      {/* Removed User ID Display */}

      {/* Header Section */}
      <header className='w-full max-w-4xl bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6 mb-8 flex flex-col sm:flex-row items-center justify-between'>
        <h1 className='text-3xl sm:text-4xl font-bold text-indigo-700 dark:text-indigo-400 mb-4 sm:mb-0'>
          Flashcard Pro
        </h1>
        <div className='flex space-x-3'>
          {/* Navigation Buttons */}
          <button
            onClick={() => {
              setCurrentPage('home');
              setSelectedDeck(null);
              setReviewMode(false);
              setShowDashboard(false);
            }}
            className={`flex items-center px-4 py-2 rounded-lg shadow-md transition-colors duration-300 transform hover:scale-105 ${
              currentPage === 'home'
                ? 'bg-indigo-700 text-white'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            Home
          </button>
          {userId && ( // Show Dashboard and Decks only if logged in
            <>
              <button
                onClick={() => {
                  setCurrentPage('dashboard');
                  setSelectedDeck(null);
                  setReviewMode(false);
                  setShowDashboard(true);
                }}
                className={`flex items-center px-4 py-2 rounded-lg shadow-md transition-colors duration-300 transform hover:scale-105 ${
                  currentPage === 'dashboard'
                    ? 'bg-purple-700 text-white'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                <LayoutDashboard className='mr-2 h-5 w-5' /> Dashboard
              </button>
              <button
                onClick={() => {
                  setCurrentPage('decks');
                  setSelectedDeck(null);
                  setReviewMode(false);
                  setShowDashboard(false);
                }}
                className={`flex items-center px-4 py-2 rounded-lg shadow-md transition-colors duration-300 transform hover:scale-105 ${
                  currentPage === 'decks'
                    ? 'bg-indigo-700 text-white'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                <BookOpen className='mr-2 h-5 w-5' /> Your Decks
              </button>
            </>
          )}
          {userId ? ( // Show Logout if logged in
            <button
              onClick={handleLogout}
              className='flex items-center px-4 py-2 bg-red-600 text-white rounded-lg shadow-md hover:bg-red-700 transition-colors duration-300 transform hover:scale-105'
            >
              <LogOut className='mr-2 h-5 w-5' /> Logout
            </button>
          ) : (
            // Show Login/Signup if not logged in
            <>
              <button
                onClick={() => {
                  setCurrentPage('login');
                  setSelectedDeck(null);
                  setReviewMode(false);
                  setShowDashboard(false);
                }}
                className={`flex items-center px-4 py-2 rounded-lg shadow-md transition-colors duration-300 transform hover:scale-105 ${
                  currentPage === 'login'
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                <LogIn className='mr-2 h-5 w-5' /> Login
              </button>
              <button
                onClick={() => {
                  setCurrentPage('signup');
                  setSelectedDeck(null);
                  setReviewMode(false);
                  setShowDashboard(false);
                }}
                className={`flex items-center px-4 py-2 rounded-lg shadow-md transition-colors duration-300 transform hover:scale-105 ${
                  currentPage === 'signup'
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                <UserPlus className='mr-2 h-5 w-5' /> Signup
              </button>
            </>
          )}
        </div>
      </header>

      {/* Auth Error Display */}
      {authError && (
        <div
          className='w-full max-w-4xl bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-4'
          role='alert'
        >
          <strong className='font-bold'>Authentication Error:</strong>
          <span className='block sm:inline ml-2'>{authError}</span>
          <span
            className='absolute top-0 bottom-0 right-0 px-4 py-3 cursor-pointer'
            onClick={() => setAuthError('')}
          >
            <svg
              className='fill-current h-6 w-6 text-red-500'
              role='button'
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 20 20'
            >
              <title>Close</title>
              <path d='M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z' />
            </svg>
          </span>
        </div>
      )}

      {/* Add New Deck Modal/Form - RE-ADDED */}
      {isAddingDeck && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
          <div className='bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md'>
            <h2 className='text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100'>
              Create New Deck
            </h2>
            <input
              type='text'
              placeholder='Deck Name'
              value={newDeckName}
              onChange={(e) => setNewDeckName(e.target.value)}
              className='w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-4 focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            />
            <div className='flex justify-end space-x-3'>
              <button
                onClick={() => {
                  setIsAddingDeck(false);
                  setNewDeckName(''); // Clear input on cancel
                  setAuthError(''); // Clear any auth errors
                }}
                className='px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-700 transition-colors'
              >
                Cancel
              </button>
              <button
                onClick={addDeck}
                className='px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors'
              >
                Create Deck
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area - Conditional Rendering based on currentPage */}
      <main
        key={currentPage}
        className='w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-8'
      >
        {(() => {
          switch (currentPage) {
            case 'home':
              return <HomePage />;
            case 'login':
              return <AuthForm type='login' onAuth={handleLogin} />;
            case 'signup':
              return <AuthForm type='signup' onAuth={handleSignUp} />;
            case 'dashboard':
              // Dashboard content
              return (
                <section className='md:col-span-3 bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6'>
                  <h2 className='text-3xl font-semibold mb-6 text-gray-900 dark:text-gray-100 flex items-center'>
                    <LayoutDashboard className='mr-3 h-7 w-7 text-purple-500' />{' '}
                    Overall Dashboard
                  </h2>
                  <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'>
                    <div className='bg-blue-50 dark:bg-blue-900 rounded-lg p-5 text-center shadow-md'>
                      <p className='text-4xl font-bold text-blue-600 dark:text-blue-300'>
                        {totalDecksOverall}
                      </p>
                      <p className='text-sm text-gray-600 dark:text-gray-400 mt-2'>
                        Total Decks
                      </p>
                    </div>
                    <div className='bg-green-50 dark:bg-green-900 rounded-lg p-5 text-center shadow-md'>
                      <p className='text-4xl font-bold text-green-600 dark:text-green-300'>
                        {totalCardsOverall}
                      </p>
                      <p className='text-sm text-gray-600 dark:text-gray-400 mt-2'>
                        Total Cards
                      </p>
                    </div>
                    <div className='bg-red-50 dark:bg-red-900 rounded-lg p-5 text-center shadow-md'>
                      <p className='text-4xl font-bold text-red-600 dark:text-red-300'>
                        {totalDueCardsOverall}
                      </p>
                      <p className='text-sm text-gray-600 dark:text-gray-400 mt-2'>
                        Cards Due Now
                      </p>
                    </div>
                    <div className='bg-purple-50 dark:bg-purple-900 rounded-lg p-5 text-center shadow-md'>
                      <p className='text-4xl font-bold text-purple-600 dark:text-purple-300'>
                        {totalLearnedCardsOverall}
                      </p>
                      <p className='text-sm text-gray-600 dark:text-gray-400 mt-2'>
                        Cards Learned
                      </p>
                    </div>
                  </div>
                  {totalDecksOverall === 0 && (
                    <p className='text-center text-gray-600 dark:text-gray-400 mt-8 text-lg'>
                      Start by adding a new deck to see your progress here!
                    </p>
                  )}
                </section>
              );
            case 'decks':
              // Decks and Cards content
              return (
                <>
                  {/* Deck List Section (Left Column) */}
                  <section className='md:col-span-1 bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6 h-fit'>
                    <h2 className='text-2xl font-semibold mb-6 text-gray-900 dark:text-gray-100 flex items-center'>
                      <BookOpen className='mr-3 h-6 w-6 text-indigo-500' /> Your
                      Decks
                    </h2>
                    {console.log(
                      'Rendering Decks section. Current userId:',
                      userId
                    )}{' '}
                    {/* Debugging log */}
                    {userId ? ( // Only allow adding decks if logged in
                      <button
                        onClick={() => {
                          console.log('Add New Deck button clicked!');
                          setIsAddingDeck(true);
                        }}
                        className='flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition-colors duration-300 transform hover:scale-105 mb-4 w-full justify-center'
                      >
                        <PlusCircle className='mr-2 h-5 w-5' /> Add New Deck
                      </button>
                    ) : (
                      <p className='text-gray-600 dark:text-gray-400 mb-4'>
                        Log in to create and manage decks.
                      </p>
                    )}
                    {decks.length === 0 ? (
                      <p className='text-gray-600 dark:text-gray-400'>
                        No decks yet.
                      </p>
                    ) : (
                      <ul className='space-y-3'>
                        {decks.map((deck) => (
                          <li key={deck.id}>
                            <button
                              onClick={() => {
                                setSelectedDeck(deck);
                                setReviewMode(false);
                              }}
                              className={`w-full text-left px-4 py-3 rounded-lg flex items-center justify-between
                                ${
                                  selectedDeck?.id === deck.id
                                    ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 font-semibold'
                                    : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200'
                                }
                                transition-colors duration-200 transform hover:scale-[1.02]`}
                            >
                              <span>{deck.name}</span>
                              <span className='text-sm text-gray-500 dark:text-gray-400'>
                                ({deck.cardCount || 0} cards)
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  {/* Card List / Review Section (Right Column) */}
                  <section className='md:col-span-2 bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6'>
                    {selectedDeck ? (
                      <>
                        <h2 className='text-2xl font-semibold mb-6 text-gray-900 dark:text-gray-100 flex items-center justify-between'>
                          <span>
                            <Brain className='mr-3 h-6 w-6 text-indigo-500 inline-block' />
                            {reviewMode
                              ? `Reviewing "${selectedDeck.name}" (${
                                  currentReviewCardIndex + 1
                                }/${reviewCards.length})`
                              : `Cards in "${selectedDeck.name}"`}
                          </span>
                          {!reviewMode &&
                            userId && ( // Show Add Card and Start Review buttons only if not in review mode AND logged in
                              <div className='flex space-x-3'>
                                <button
                                  onClick={() => setIsAddingCard(true)}
                                  className='flex items-center px-4 py-2 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition-colors duration-300 transform hover:scale-105 text-sm'
                                >
                                  <PlusCircle className='mr-2 h-4 w-4' /> Add
                                  Card
                                </button>
                                <button
                                  onClick={startReviewSession}
                                  className='flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors duration-300 transform hover:scale-105 text-sm'
                                >
                                  <PlayCircle className='mr-2 h-4 w-4' /> Start
                                  Review
                                </button>
                              </div>
                            )}
                          {reviewMode && ( // Show End Review button only if in review mode
                            <button
                              onClick={() => {
                                setReviewMode(false);
                                setReviewCards([]);
                                setCurrentReviewCardIndex(0);
                              }}
                              className='flex items-center px-4 py-2 bg-red-600 text-white rounded-lg shadow-md hover:bg-red-700 transition-colors duration-300 transform hover:scale-105 text-sm'
                            >
                              <XCircle className='mr-2 h-4 w-4' /> End Review
                            </button>
                          )}
                        </h2>

                        {/* User Progress Metrics for the selected deck */}
                        {!reviewMode && (
                          <div className='flex justify-around items-center bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-6 shadow-inner'>
                            <div className='text-center'>
                              <p className='text-xl font-bold text-indigo-600 dark:text-indigo-300'>
                                {selectedDeck.cardCount || 0}
                              </p>
                              <p className='text-sm text-gray-600 dark:text-gray-400'>
                                Total Cards
                              </p>
                            </div>
                            <div className='text-center'>
                              <p className='text-xl font-bold text-red-600 dark:text-red-300'>
                                {dueCardsCount}
                              </p>
                              <p className='text-sm text-gray-600 dark:text-gray-400'>
                                Due Now
                              </p>
                            </div>
                            <div className='text-center'>
                              <p className='text-xl font-bold text-green-600 dark:text-green-300'>
                                {learnedCardsCount}
                              </p>
                              <p className='text-sm text-gray-600 dark:text-gray-400'>
                                Cards Learned
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Add/Edit Card Modal/Form */}
                        {(isAddingCard || editingCard) && (
                          <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
                            <div className='bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md'>
                              <h2 className='text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100'>
                                {editingCard ? 'Edit Card' : 'Add New Card'}
                              </h2>
                              <textarea
                                placeholder='Front of card (Question)'
                                value={newCardFront}
                                onChange={(e) =>
                                  setNewCardFront(e.target.value)
                                }
                                className='w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-3 focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-y'
                                rows='3'
                              ></textarea>
                              <textarea
                                placeholder='Back of card (Answer)'
                                value={newCardBack}
                                onChange={(e) => setNewCardBack(e.target.value)}
                                className='w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-4 focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-y'
                                rows='3'
                              ></textarea>

                              {/* AI Content Generation Inputs */}
                              <div className='mt-4 border-t border-gray-200 dark:border-gray-600 pt-4'>
                                <p className='text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100'>
                                  Generate with AI:
                                </p>
                                <input
                                  type='text'
                                  placeholder="Subject (e.g., 'History of Rome')"
                                  value={aiSubject}
                                  onChange={(e) => setAiSubject(e.target.value)}
                                  className='w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-3 focus:ring-2 focus:ring-purple-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                                />
                                <textarea
                                  placeholder="Related topics (comma-separated, e.g., 'Julius Caesar, Roman Empire')"
                                  value={aiRelatedTopics}
                                  onChange={(e) =>
                                    setAiRelatedTopics(e.target.value)
                                  }
                                  className='w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-3 focus:ring-2 focus:ring-purple-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-y'
                                  rows='2'
                                ></textarea>
                                <input
                                  type='number'
                                  placeholder='Number of cards (1-5)'
                                  value={numberOfCardsToGenerate}
                                  onChange={(e) =>
                                    setNumberOfCardsToGenerate(
                                      Math.max(
                                        1,
                                        Math.min(
                                          5,
                                          parseInt(e.target.value) || 1
                                        )
                                      )
                                    )
                                  }
                                  min='1'
                                  max='5'
                                  className='w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-4 focus:ring-2 focus:ring-purple-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                                />
                              </div>

                              {/* AI Generation Button */}
                              <button
                                onClick={generateCardContentWithAI}
                                disabled={
                                  isGeneratingAIContent || !aiSubject.trim()
                                }
                                className={`flex items-center justify-center w-full px-4 py-2 rounded-lg shadow-md transition-colors duration-300 transform hover:scale-105 mb-4
                                  ${
                                    isGeneratingAIContent || !aiSubject.trim()
                                      ? 'bg-purple-400 cursor-not-allowed'
                                      : 'bg-purple-600 text-white hover:bg-purple-700'
                                  }`}
                              >
                                {isGeneratingAIContent ? (
                                  <>
                                    <svg
                                      className='animate-spin -ml-1 mr-3 h-5 w-5 text-white'
                                      xmlns='http://www.w3.org/2000/svg'
                                      fill='none'
                                      viewBox='0 0 24 24'
                                    >
                                      <circle
                                        className='opacity-25'
                                        cx='12'
                                        cy='12'
                                        r='10'
                                        stroke='currentColor'
                                        strokeWidth='4'
                                      ></circle>
                                      <path
                                        className='opacity-75'
                                        fill='currentColor'
                                        d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                                      ></path>
                                    </svg>
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <Brain className='mr-2 h-5 w-5' /> Generate
                                    with AI
                                  </>
                                )}
                              </button>

                              <div className='flex justify-end space-x-3'>
                                <button
                                  onClick={() => {
                                    setIsAddingCard(false);
                                    setEditingCard(null);
                                    setNewCardFront('');
                                    setNewCardBack('');
                                    setAiSubject('');
                                    setAiRelatedTopics('');
                                    setNumberOfCardsToGenerate(1);
                                  }}
                                  className='px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-700 transition-colors'
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={async () => {
                                    if (editingCard) {
                                      await updateCard();
                                    } else {
                                      if (
                                        !isGeneratingAIContent &&
                                        newCardFront.trim() &&
                                        newCardBack.trim()
                                      ) {
                                        await addCard({
                                          front: newCardFront,
                                          back: newCardBack,
                                        });
                                      }
                                    }
                                    setIsAddingCard(false);
                                    setEditingCard(null);
                                    setNewCardFront('');
                                    setNewCardBack('');
                                    setAiSubject('');
                                    setAiRelatedTopics('');
                                    setNumberOfCardsToGenerate(1);
                                  }}
                                  className='px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors'
                                >
                                  {editingCard ? 'Update Card' : 'Add Card'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {reviewMode ? (
                          // Review Session UI
                          reviewCards.length > 0 ? (
                            <div className='flex flex-col items-center justify-center min-h-[300px]'>
                              <Flashcard
                                card={reviewCards[currentReviewCardIndex]}
                                isReviewMode={true}
                                onReview={handleReview}
                              />
                              <div className='mt-4 text-center text-gray-600 dark:text-gray-400'>
                                <p>
                                  Reviewing card {currentReviewCardIndex + 1} of{' '}
                                  {reviewCards.length}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className='text-center py-10'>
                              <p className='text-xl text-gray-600 dark:text-gray-400'>
                                No cards due for review in this deck right now!
                              </p>
                              <button
                                onClick={() => {
                                  setReviewMode(false);
                                  setReviewCards([]);
                                  setCurrentReviewCardIndex(0);
                                }}
                                className='mt-4 px-4 py-2 bg-red-600 text-white rounded-lg shadow-md hover:bg-red-700 transition-colors duration-300 transform hover:scale-105'
                              >
                                <XCircle className='mr-2 h-4 w-4 inline-block' />{' '}
                                End Review
                              </button>
                            </div>
                          )
                        ) : // Card List UI
                        cards.length === 0 ? (
                          <p className='text-gray-600 dark:text-gray-400'>
                            No cards in this deck. Add one!
                          </p>
                        ) : (
                          <div className='grid grid-cols-1 gap-4'>
                            {cards.map((card) => (
                              <Flashcard
                                key={card.id}
                                card={card}
                                onDelete={() => deleteCard(card.id)}
                                onEdit={() => startEditCard(card)}
                                isReviewMode={false}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className='text-center py-10'>
                        <p className='text-xl text-gray-600 dark:text-gray-400'>
                          Select a deck from the left to view its cards or add
                          new ones.
                        </p>
                      </div>
                    )}
                  </section>
                </>
              );
            default:
              return <HomePage />;
          }
        })()}
      </main>

      {/* Footer */}
      <footer className='w-full max-w-4xl mt-8 text-center text-gray-600 dark:text-gray-400 text-sm'>
        <p>
          &copy; {new Date().getFullYear()} Flashcard Pro. All rights reserved.
        </p>
        <p>Built with React, Tailwind CSS, and Firebase.</p>
      </footer>
    </div>
  );
};

// --- HomePage Component ---
const HomePage = () => {
  return (
    <section className='md:col-span-3 bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6 text-center'>
      <h2 className='text-3xl font-semibold mb-4 text-gray-900 dark:text-gray-100'>
        Welcome to Flashcard Pro!
      </h2>
      <p className='text-lg text-gray-700 dark:text-gray-300 mb-6'>
        Your ultimate tool for enhanced learning and knowledge retention.
      </p>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-6 text-left'>
        <div className='bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-inner'>
          <h3 className='text-xl font-bold text-indigo-600 dark:text-indigo-300 mb-2'>
            📚 Deck & Card Management
          </h3>
          <p className='text-gray-800 dark:text-gray-200'>
            Create, organize, and manage your flashcard decks. Add questions and
            answers to build your personalized learning library.
          </p>
        </div>
        <div className='bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-inner'>
          <h3 className='text-xl font-bold text-blue-600 dark:text-blue-300 mb-2'>
            🔄 Spaced Repetition System
          </h3>
          <p className='text-gray-800 dark:text-gray-200'>
            Leverage the power of the SM-2 algorithm to optimize your review
            schedule, ensuring you review cards at the most effective times for
            long-term memory.
          </p>
        </div>
        <div className='bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-inner'>
          <h3 className='text-xl font-bold text-purple-600 dark:text-purple-300 mb-2'>
            🧠 AI Content Generation
          </h3>
          <p className='text-gray-800 dark:text-gray-200'>
            Stuck on creating content? Our integrated AI can generate flashcard
            questions and answers for you based on a subject and related topics.
          </p>
        </div>
        <div className='bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-inner'>
          <h3 className='text-xl font-bold text-green-600 dark:text-green-300 mb-2'>
            📊 Progress Tracking
          </h3>
          <p className='text-gray-800 dark:text-gray-200'>
            Keep track of your learning journey with a dedicated dashboard
            showing your total cards, cards due, and learned cards across all
            your decks.
          </p>
        </div>
      </div>
      <p className='mt-8 text-lg text-gray-700 dark:text-gray-300'>
        Ready to start learning?{' '}
        <span className='font-bold text-indigo-600 dark:text-indigo-400'>
          Login or Sign Up
        </span>{' '}
        to create your first deck!
      </p>
    </section>
  );
};

// --- AuthForm Component ---
const AuthForm = ({ type, onAuth }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setMessage('');
    if (type === 'signup' && password !== confirmPassword) {
      setMessage('Passwords do not match!');
      return;
    }
    onAuth(email, password);
  };

  return (
    <section className='md:col-span-3 flex items-center justify-center p-4'>
      <div className='bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-md'>
        <h2 className='text-3xl font-bold mb-6 text-center text-gray-900 dark:text-gray-100'>
          {type === 'login' ? 'Login' : 'Sign Up'}
        </h2>
        {message && (
          <div
            className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4'
            role='alert'
          >
            {message}
          </div>
        )}
        <form onSubmit={handleSubmit} className='space-y-5'>
          <div>
            <label
              htmlFor='email'
              className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
            >
              Email
            </label>
            <input
              type='email'
              id='email'
              placeholder='your.email@example.com'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className='w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            />
          </div>
          <div>
            <label
              htmlFor='password'
              className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
            >
              Password
            </label>
            <input
              type='password'
              id='password'
              placeholder='••••••••'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className='w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            />
          </div>
          {type === 'signup' && (
            <div>
              <label
                htmlFor='confirm-password'
                className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
              >
                Confirm Password
              </label>
              <input
                type='password'
                id='confirm-password'
                placeholder='••••••••'
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className='w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              />
            </div>
          )}
          <button
            type='submit'
            className='w-full px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition-colors duration-300 transform hover:scale-105 font-semibold'
          >
            {type === 'login' ? 'Login' : 'Sign Up'}
          </button>
        </form>
      </div>
    </section>
  );
};

// --- Flashcard Component ---
const Flashcard = ({ card, onDelete, onEdit, isReviewMode, onReview }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    setIsFlipped(false);
  }, [card.id]);

  const formatNextReviewDate = (isoString) => {
    if (!isoString)
      return {
        text: 'N/A',
        status: 'none',
        icon: null,
        colorClass: 'text-gray-500',
      };

    const date = new Date(isoString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(today.getDate() + 2);

    const cardDate = new Date(date);
    cardDate.setHours(0, 0, 0, 0);

    const currentTime = new Date();

    if (date <= currentTime) {
      return {
        text: 'Due Now',
        status: 'due',
        icon: AlertCircle,
        colorClass: 'text-red-500 dark:text-red-400',
      };
    } else if (cardDate.getTime() === today.getTime()) {
      return {
        text: 'Today',
        status: 'today',
        icon: Clock,
        colorClass: 'text-orange-500 dark:text-orange-400',
      };
    } else if (cardDate.getTime() === tomorrow.getTime()) {
      return {
        text: 'Tomorrow',
        status: 'tomorrow',
        icon: CalendarDays,
        colorClass: 'text-yellow-500 dark:text-yellow-400',
      };
    } else {
      return {
        text: date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        status: 'future',
        icon: CalendarDays,
        colorClass: 'text-green-500 dark:text-green-400',
      };
    }
  };

  const {
    text: reviewDateText,
    status: reviewDateStatus,
    icon: ReviewIcon,
    colorClass: reviewDateColorClass,
  } = formatNextReviewDate(card.nextReviewDate);

  return (
    <div
      className='relative bg-white dark:bg-gray-700 rounded-xl shadow-md p-6 cursor-pointer transform transition-all duration-300 hover:scale-[1.02] flex flex-col justify-between'
      onClick={() => isReviewMode && setIsFlipped(!isFlipped)}
      style={{ minHeight: '180px' }}
    >
      <div className='text-lg font-medium text-gray-900 dark:text-gray-100 flex-grow'>
        {isFlipped ? card.back : card.front}
      </div>

      {!isReviewMode && (
        <div className='absolute bottom-3 right-3 flex space-x-2'>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className='p-2 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors'
            title='Edit Card'
          >
            <Edit className='h-4 w-4' />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className='p-2 rounded-full bg-red-100 dark:bg-red-800 text-red-600 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-700 transition-colors'
            title='Delete Card'
          >
            <Trash2 className='h-4 w-4' />
          </button>
        </div>
      )}

      {isReviewMode && isFlipped && (
        <div className='mt-4 flex justify-center space-x-2 sm:space-x-3'>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReview(card, 0);
            }}
            className='flex items-center px-2 py-2 sm:px-3 bg-gray-500 text-white rounded-lg shadow-md hover:bg-gray-600 transition-colors transform hover:scale-105 text-sm'
          >
            <RotateCcw className='mr-1 h-4 w-4' /> Again
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReview(card, 1);
            }}
            className='flex items-center px-2 py-2 sm:px-3 bg-red-500 text-white rounded-lg shadow-md hover:bg-red-600 transition-colors transform hover:scale-105 text-sm'
          >
            <XCircle className='mr-1 h-4 w-4' /> Hard
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReview(card, 3);
            }}
            className='flex items-center px-2 py-2 sm:px-3 bg-yellow-500 text-white rounded-lg shadow-md hover:bg-yellow-600 transition-colors transform hover:scale-105 text-sm'
          >
            <Clock className='mr-1 h-4 w-4' /> Good
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReview(card, 5);
            }}
            className='flex items-center px-2 py-2 sm:px-3 bg-green-500 text-white rounded-lg shadow-md hover:bg-green-600 transition-colors transform hover:scale-105 text-sm'
          >
            <CheckCircle className='mr-1 h-4 w-4' /> Easy
          </button>
        </div>
      )}
      {isReviewMode && !isFlipped && (
        <div className='mt-4 text-center text-gray-500 dark:text-gray-400 text-sm'>
          Click to flip
        </div>
      )}
      {!isReviewMode && card.nextReviewDate && (
        <div
          className={`absolute bottom-3 left-3 text-xs flex items-center ${reviewDateColorClass}`}
        >
          {ReviewIcon && <ReviewIcon className='h-3 w-3 mr-1' />}
          Next Review: {reviewDateText}
        </div>
      )}
    </div>
  );
};

export default App;
