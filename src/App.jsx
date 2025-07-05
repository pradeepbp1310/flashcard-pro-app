import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
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
} from 'lucide-react'; // Added RotateCcw for "Again" button

// Main App Component
const App = () => {
  // State variables for Firebase and user data
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [decks, setDecks] = useState([]);
  const [selectedDeck, setSelectedDeck] = useState(null);
  const [cards, setCards] = useState([]); // 'cards' state already holds cards for the selected deck
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
  const [numberOfCardsToGenerate, setNumberOfCardsToGenerate] = useState(1); // New state for number of cards

  // Spaced Repetition / Review Session States
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewCards, setReviewCards] = useState([]);
  const [currentReviewCardIndex, setCurrentReviewCardIndex] = useState(0);

  // --- IMPORTANT: Firebase project configuration ---
  // For local development, Firebase config is read from environment variables.
  // If import.meta.env is not available (e.g., due to older JS target),
  // ensure you have your .env.local file correctly populated with actual values.
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
  // Note: Your actual Firebase config values should be in your .env.local file.

  // Firebase Initialization and Authentication
  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        const firebaseConfigToUse =
          typeof __firebase_config !== 'undefined'
            ? JSON.parse(__firebase_config)
            : localFirebaseConfig;

        const currentAppId =
          typeof __app_id !== 'undefined' ? __app_id : 'flashcard-app';

        console.log('Firebase config being used:', firebaseConfigToUse);
        console.log(
          'Keys in Firebase config:',
          Object.keys(firebaseConfigToUse).length
        );

        // Basic validation for localFirebaseConfig to ensure values are not undefined/empty
        const isLocalConfigValid = Object.values(localFirebaseConfig).every(
          (value) =>
            value !== undefined &&
            value !== null &&
            value !== '' &&
            !value.startsWith('YOUR_')
        );

        if (
          !firebaseConfigToUse ||
          Object.keys(firebaseConfigToUse).length < 6 ||
          (typeof __firebase_config === 'undefined' && !isLocalConfigValid) // Check local config validity only if not in Canvas
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

        const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
          if (user) {
            setUserId(user.uid);
            console.log('User signed in:', user.uid);
          } else {
            try {
              const initialAuthToken =
                typeof __initial_auth_token !== 'undefined'
                  ? __initial_auth_token
                  : null;
              if (initialAuthToken) {
                await signInWithCustomToken(firebaseAuth, initialAuthToken);
                console.log('Signed in with custom token.');
              } else {
                await signInAnonymously(firebaseAuth);
                console.log('Signed in anonymously.');
              }
            } catch (error) {
              console.error(
                'Firebase authentication error: ',
                error.code,
                error.message,
                error
              );
              if (error.code === 'auth/configuration-not-found') {
                console.error(
                  "ACTION REQUIRED: Firebase 'auth/configuration-not-found' error. This often means:"
                );
                console.error(
                  "1. Your 'authDomain' or 'projectId' in .env.local is incorrect or has a typo."
                );
                console.error(
                  '2. Anonymous Authentication is not enabled in your Firebase project settings.'
                );
                console.error(
                  "   Go to Firebase Console -> Authentication -> Sign-in method tab -> Enable 'Anonymous'."
                );
              }
            }
          }
          setLoading(false);
        });

        window.currentAppId = currentAppId;

        return () => unsubscribe();
      } catch (error) {
        console.error('Error initializing Firebase:', error);
        setLoading(false);
      }
    };

    initializeFirebase();
  }, []);

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
  }, [decks, selectedDeck]); // Depend on 'decks' array and 'selectedDeck.id'

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

  // Function to add a new deck to Firestore
  const addDeck = async () => {
    if (!newDeckName.trim() || !db || !userId || !window.currentAppId) return;
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
      console.log('Deck added successfully!');
    } catch (e) {
      console.error('Error adding document: ', e);
    }
  };

  // Function to add a new card to the currently selected deck in Firestore
  const addCard = async (cardData) => {
    // Modified to accept cardData
    if (!db || !userId || !selectedDeck || !window.currentAppId) return;
    try {
      await addDoc(
        collection(
          db,
          `artifacts/${window.currentAppId}/users/${userId}/decks/${selectedDeck.id}/cards`
        ),
        {
          front: cardData.front, // Use provided cardData
          back: cardData.back, // Use provided cardData
          easeFactor: 2.5, // Initial ease factor
          interval: 0, // Initial interval in days
          repetitions: 0, // Initial repetitions
          nextReviewDate: new Date().toISOString(), // Due immediately
          createdAt: new Date().toISOString(),
        }
      );

      const deckRef = doc(
        db,
        `artifacts/${window.currentAppId}/users/${userId}/decks`,
        selectedDeck.id
      );
      // Manually increment card count
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
      // Manually decrement card count
      const deckSnap = await getDoc(deckRef);
      if (deckSnap.exists()) {
        const currentCardCount = deckSnap.data().cardCount || 0;
        await updateDoc(deckRef, {
          cardCount: Math.max(0, currentCardCount - 1), // Ensure count doesn't go below zero
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
    // Reset AI input fields when editing a card
    setAiSubject('');
    setAiRelatedTopics('');
    setNumberOfCardsToGenerate(1); // Reset number of cards to 1
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
      // Get a sample of existing cards to provide context to the AI
      // Limit to the most recent 5 cards to keep the prompt concise
      const existingCardContext = cards
        .slice(-5)
        .map((card) => `Q: ${card.front}\nA: ${card.back}`)
        .join('\n---\n');

      let contextPrompt = '';
      if (existingCardContext) {
        contextPrompt = `Consider the following existing flashcards from this deck to generate new, related, but not identical, content:\n${existingCardContext}\n---\n`;
      }

      // Construct the prompt to ask for multiple cards
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
            type: 'ARRAY', // Expect an array
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

      // For local development, access the API key via environment variables (Vite specific)
      // For Canvas environment, the API key will be automatically provided if `apiKey` is empty string.
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
        const parsedContent = JSON.parse(aiText); // Parse the JSON array

        if (Array.isArray(parsedContent) && parsedContent.length > 0) {
          // Add each generated card to Firestore
          for (const card of parsedContent) {
            if (card.question && card.answer) {
              await addCard({ front: card.question, back: card.answer });
            }
          }
          // Optionally, set the last generated card to the form for immediate editing/viewing
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

  // Function to prepare cards for a review session
  const startReviewSession = () => {
    if (!selectedDeck || cards.length === 0) {
      console.log('No cards in this deck to review or no deck selected.');
      return;
    }

    const now = new Date();
    // Filter cards that are due for review (nextReviewDate is in the past or today)
    const dueCards = cards.filter((card) => {
      const nextReview = new Date(card.nextReviewDate);
      return nextReview <= now;
    });

    // Sort due cards (e.g., by oldest review date first)
    dueCards.sort(
      (a, b) => new Date(a.nextReviewDate) - new Date(b.nextReviewDate)
    );

    if (dueCards.length === 0) {
      console.log('No cards due for review in this deck.');
      // Optionally, show a message to the user that no cards are due
      return;
    }

    setReviewCards(dueCards);
    setCurrentReviewCardIndex(0);
    setReviewMode(true);
    console.log('Starting review session with', dueCards.length, 'cards.');
  };

  // SM-2 Algorithm implementation
  const calculateNextReview = (card, quality) => {
    let { repetitions, interval, easeFactor } = card;

    if (quality === 0) {
      // Again (completely forgot, show very soon)
      repetitions = 0;
      interval = 0; // Means due immediately (within minutes)
      easeFactor = easeFactor - 0.2; // More aggressive decrease for "Again"
    } else if (quality >= 3) {
      // Correct response (Good or Easy)
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetitions++;
    } else {
      // Quality 1 or 2 (Incorrect, but recognized / Hard)
      repetitions = 0;
      interval = 1; // Due tomorrow
    }

    // Adjust ease factor based on quality (only if not "Again" - quality 0)
    if (quality > 0) {
      easeFactor =
        easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    }
    if (easeFactor < 1.3) {
      easeFactor = 1.3; // Minimum ease factor
    }

    const nextReviewDate = new Date();
    if (interval === 0) {
      // For "Again" (quality 0), schedule for a few minutes later
      nextReviewDate.setMinutes(nextReviewDate.getMinutes() + 5); // Show in 5 minutes
    } else {
      nextReviewDate.setDate(nextReviewDate.getDate() + interval);
    }

    return {
      repetitions,
      interval,
      easeFactor,
      nextReviewDate: nextReviewDate.toISOString(),
    };
  };

  // Function to handle a card review (called by Flashcard component)
  const handleReview = async (card, quality) => {
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

      // Move to the next card in the review session
      if (currentReviewCardIndex < reviewCards.length - 1) {
        setCurrentReviewCardIndex((prevIndex) => prevIndex + 1);
      } else {
        // End of review session
        setReviewMode(false);
        setReviewCards([]);
        setCurrentReviewCardIndex(0);
        console.log('Review session completed!');
      }
    } catch (e) {
      console.error('Error updating card after review: ', e);
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

  // Main application UI
  return (
    <div className='min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-inter flex flex-col items-center p-4 sm:p-6 md:p-8'>
      {/* User ID Display - Useful for debugging and understanding data ownership in Firestore */}
      <div className='w-full max-w-4xl text-right text-sm text-gray-600 dark:text-gray-400 mb-4'>
        User ID: {userId || 'N/A'}
      </div>

      {/* Header Section */}
      <header className='w-full max-w-4xl bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6 mb-8 flex flex-col sm:flex-row items-center justify-between'>
        <h1 className='text-3xl sm:text-4xl font-bold text-indigo-700 dark:text-indigo-400 mb-4 sm:mb-0'>
          Flashcard Pro
        </h1>
        {/* Button to open the "Add New Deck" modal */}
        <button
          onClick={() => setIsAddingDeck(true)}
          className='flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition-colors duration-300 transform hover:scale-105'
        >
          <PlusCircle className='mr-2 h-5 w-5' /> Add New Deck
        </button>
      </header>

      {/* Add New Deck Modal/Form */}
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
                onClick={() => setIsAddingDeck(false)} // Close modal
                className='px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-700 transition-colors'
              >
                Cancel
              </button>
              <button
                onClick={addDeck} // Call addDeck function
                className='px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors'
              >
                Create Deck
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area - Grid Layout */}
      <main className='w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-8'>
        {/* Deck List Section (Left Column) */}
        <section className='md:col-span-1 bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6 h-fit'>
          <h2 className='text-2xl font-semibold mb-6 text-gray-900 dark:text-gray-100 flex items-center'>
            <BookOpen className='mr-3 h-6 w-6 text-indigo-500' /> Your Decks
          </h2>
          {decks.length === 0 ? (
            <p className='text-gray-600 dark:text-gray-400'>
              No decks yet. Add one to get started!
            </p>
          ) : (
            <ul className='space-y-3'>
              {decks.map((deck) => (
                <li key={deck.id}>
                  <button
                    onClick={() => {
                      setSelectedDeck(deck);
                      setReviewMode(false);
                    }} // Select a deck, exit review mode
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
                {!reviewMode && ( // Show Add Card and Start Review buttons only if not in review mode
                  <div className='flex space-x-3'>
                    <button
                      onClick={() => setIsAddingCard(true)}
                      className='flex items-center px-4 py-2 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition-colors duration-300 transform hover:scale-105 text-sm'
                    >
                      <PlusCircle className='mr-2 h-4 w-4' /> Add Card
                    </button>
                    <button
                      onClick={startReviewSession}
                      className='flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors duration-300 transform hover:scale-105 text-sm'
                    >
                      <PlayCircle className='mr-2 h-4 w-4' /> Start Review
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
                      onChange={(e) => setNewCardFront(e.target.value)}
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
                        onChange={(e) => setAiRelatedTopics(e.target.value)}
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
                              Math.min(5, parseInt(e.target.value) || 1)
                            )
                          )
                        } // Clamp between 1 and 5
                        min='1'
                        max='5'
                        className='w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-4 focus:ring-2 focus:ring-purple-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                      />
                    </div>

                    {/* AI Generation Button */}
                    <button
                      onClick={generateCardContentWithAI}
                      disabled={isGeneratingAIContent || !aiSubject.trim()} // Disable if no subject or generating
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
                          <Brain className='mr-2 h-5 w-5' /> Generate with AI
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
                        }} // Close modal and reset form
                        className='px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-700 transition-colors'
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          // Modified to handle multiple cards if generated
                          if (editingCard) {
                            await updateCard();
                          } else {
                            // If AI generated cards, they are already added.
                            // If not, and user manually entered, add the single card.
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
                      <XCircle className='mr-2 h-4 w-4 inline-block' /> End
                      Review
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
                      isReviewMode={false} // Not in review mode
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className='text-center py-10'>
              <p className='text-xl text-gray-600 dark:text-gray-400'>
                Select a deck from the left to view its cards or add new ones.
              </p>
            </div>
          )}
        </section>
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

// Flashcard Component - Displays a single flashcard
const Flashcard = ({ card, onDelete, onEdit, isReviewMode, onReview }) => {
  const [isFlipped, setIsFlipped] = useState(false); // State to control card flip

  // Reset flip state when card changes (e.g., next card in review session)
  useEffect(() => {
    setIsFlipped(false);
  }, [card.id]);

  const formatNextReviewDate = (isoString) => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today's date to start of day

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(today.getDate() + 2);

    const cardDate = new Date(date);
    cardDate.setHours(0, 0, 0, 0); // Normalize card date to start of day

    if (cardDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (cardDate.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    } else if (cardDate.getTime() < today.getTime()) {
      return 'Overdue';
    } else if (cardDate.getTime() === dayAfterTomorrow.getTime()) {
      return 'Day after tomorrow';
    } else {
      // For future dates, format nicely
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  };

  return (
    <div
      className='relative bg-white dark:bg-gray-700 rounded-xl shadow-md p-6 cursor-pointer transform transition-all duration-300 hover:scale-[1.02] flex flex-col justify-between'
      onClick={() => isReviewMode && setIsFlipped(!isFlipped)} // Only flip if in review mode
      style={{ minHeight: '180px' }} // Increased height for review buttons
    >
      <div className='text-lg font-medium text-gray-900 dark:text-gray-100 flex-grow'>
        {isFlipped ? card.back : card.front}
      </div>

      {!isReviewMode && ( // Show edit/delete buttons only if not in review mode
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

      {isReviewMode &&
        isFlipped && ( // Show review buttons only if in review mode AND flipped
          <div className='mt-4 flex justify-center space-x-2 sm:space-x-3'>
            {' '}
            {/* Adjusted spacing for responsiveness */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReview(card, 0);
              }} // Quality 0: Again
              className='flex items-center px-2 py-2 sm:px-3 bg-gray-500 text-white rounded-lg shadow-md hover:bg-gray-600 transition-colors transform hover:scale-105 text-sm'
            >
              <RotateCcw className='mr-1 h-4 w-4' /> Again
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReview(card, 1);
              }} // Quality 1: Hard
              className='flex items-center px-2 py-2 sm:px-3 bg-red-500 text-white rounded-lg shadow-md hover:bg-red-600 transition-colors transform hover:scale-105 text-sm'
            >
              <XCircle className='mr-1 h-4 w-4' /> Hard
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReview(card, 3);
              }} // Quality 3: Good
              className='flex items-center px-2 py-2 sm:px-3 bg-yellow-500 text-white rounded-lg shadow-md hover:bg-yellow-600 transition-colors transform hover:scale-105 text-sm'
            >
              <Clock className='mr-1 h-4 w-4' /> Good
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReview(card, 5);
              }} // Quality 5: Easy
              className='flex items-center px-2 py-2 sm:px-3 bg-green-500 text-white rounded-lg shadow-md hover:bg-green-600 transition-colors transform hover:scale-105 text-sm'
            >
              <CheckCircle className='mr-1 h-4 w-4' /> Easy
            </button>
          </div>
        )}
      {isReviewMode &&
        !isFlipped && ( // Show "Flip Card" hint when not flipped in review mode
          <div className='mt-4 text-center text-gray-500 dark:text-gray-400 text-sm'>
            Click to flip
          </div>
        )}
      {!isReviewMode &&
        card.nextReviewDate && ( // Show next review date in list view
          <div className='absolute bottom-3 left-3 text-xs text-gray-500 dark:text-gray-400'>
            Next Review: {formatNextReviewDate(card.nextReviewDate)}
          </div>
        )}
    </div>
  );
};

export default App;
