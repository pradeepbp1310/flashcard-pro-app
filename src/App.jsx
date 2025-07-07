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
  getDocs,
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
  CheckSquare,
  Layers,
  Code,
  Database,
  Zap,
  Sparkles,
  TrendingUp,
  FolderDot,
  User,
  Share2,
  Settings,
  FileText,
  Lightbulb,
  Compass,
  Type,
  List,
  Grid,
  Sun,
  Moon,
  Menu,
  X,
} from 'lucide-react'; // Added List, Grid, Sun, Moon, Menu, X icons

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
  const [newCardFront, setNewCardFront] = useState(''); // FIX: Correctly use useState
  const [newCardBack, setNewCardBack] = useState(''); // FIX: Correctly use useState
  const [isAddingDeck, setIsAddingDeck] = useState(false);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [isGeneratingAIContent, setIsGeneratingAIContent] = useState(false);

  // New state variables for AI content generation input
  const [aiSubject, setAiSubject] = useState('');
  const [aiRelatedTopics, setAiRelatedTopics] = useState('');
  const [numberOfCardsToGenerate, setNumberOfCardsToGenerate] = useState(1);
  const [aiCopiedText, setAiCopiedText] = useState(''); // New state for copied text

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
  const [showDeleteDeckConfirm, setShowDeleteDeckConfirm] = useState(false);
  const [deckToDelete, setDeckToDelete] = useState(null);

  // New state to explicitly track if Firebase Auth is ready for operations
  const [isAuthServiceReady, setIsAuthServiceReady] = useState(false);

  // New state for card view mode (list or grid)
  const [cardViewMode, setCardViewMode] = useState('grid'); // Default to grid view

  // Pagination states
  const [cardsPerPage] = useState(10); // Number of cards per page
  const [currentCardPage, setCurrentCardPage] = useState(1); // Current page for cards

  // Mobile menu state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Initialize theme from localStorage or default to system preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    // Check system preference only if no theme is saved in localStorage
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Effect to apply dark mode class to HTML
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      console.log('Applying dark mode class.');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      console.log('Removing dark mode class.');
    }
  }, [isDarkMode]);

  // Firebase Initialization and Authentication
  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        // Determine the Firebase config to use
        let firebaseConfigToUse;
        if (typeof __firebase_config !== 'undefined' && __firebase_config) {
          // Canvas environment provides __firebase_config
          firebaseConfigToUse = JSON.parse(__firebase_config);
          console.log('Using Canvas-provided Firebase config.');
        } else {
          // Local development environment, use VITE_ environment variables from .env.local
          firebaseConfigToUse = {
            apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
            authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
            projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
            storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: import.meta.env
              .VITE_FIREBASE_MESSAGING_SENDER_ID,
            appId: import.meta.env.VITE_FIREBASE_APP_ID,
          };
          console.log('Using local .env variables for Firebase config.');
        }

        // Use __app_id from Canvas environment if available, otherwise fallback to a default
        const currentAppId =
          typeof __app_id !== 'undefined' && __app_id
            ? __app_id
            : 'flashcard-app'; // Default app ID for local development

        console.log('Firebase config being used:', firebaseConfigToUse);
        console.log(
          'Keys in Firebase config:',
          Object.keys(firebaseConfigToUse).length
        );

        // Basic validation for the config to ensure it's not empty/placeholder
        const requiredKeys = [
          'apiKey',
          'authDomain',
          'projectId',
          'storageBucket',
          'messagingSenderId',
          'appId',
        ];
        const isConfigComplete = requiredKeys.every(
          (key) =>
            firebaseConfigToUse[key] !== undefined &&
            firebaseConfigToUse[key] !== null &&
            firebaseConfigToUse[key] !== ''
        );

        if (!isConfigComplete) {
          console.error(
            'Firebase config is missing or incomplete. Please ensure Firebase variables are set up correctly in your .env.local file or Canvas environment.'
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
        setIsAuthServiceReady(true); // Firebase Auth service is now ready

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
        setIsAuthServiceReady(false); // Ensure auth service is marked not ready on error
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
          setCurrentCardPage(1); // Reset to first page when deck changes
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

      setDueCardsCount(learned); // Changed to count cards with repetitions > 0 as "learned"
      setLearnedCardsCount(dueToday); // Changed to count cards with nextReviewDate <= currentTime as "due"
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
      const docRef = await addDoc(
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
      console.log('Deck added successfully with ID:', docRef.id);

      // Automatically select the new deck and open the add card modal
      const newDeck = {
        id: docRef.id,
        name: newDeckName,
        cardCount: 0,
        createdAt: new Date().toISOString(),
      };
      setSelectedDeck(newDeck);
      setCurrentPage('decks'); // Ensure we are on the decks page
      setIsAddingCard(true); // Open the add card modal for the new deck
    } catch (e) {
      console.error('Error adding document: ', e);
      setAuthError(`Error adding deck: ${e.message}`);
      setIsAddingDeck(false); // Close modal on error
    }
  };

  // Function to delete a deck from Firestore
  const deleteDeck = async (deckId) => {
    if (!db || !userId || !window.currentAppId) return;
    try {
      // First, delete all cards within the deck
      const cardsCollectionRef = collection(
        db,
        `artifacts/${window.currentAppId}/users/${userId}/decks/${deckId}/cards`
      );
      const cardsSnapshot = await getDocs(query(cardsCollectionRef));
      const deleteCardPromises = cardsSnapshot.docs.map((cardDoc) =>
        deleteDoc(cardDoc.ref)
      );
      await Promise.all(deleteCardPromises);

      // Then, delete the deck itself
      await deleteDoc(
        doc(
          db,
          `artifacts/${window.currentAppId}/users/${userId}/decks`,
          deckId
        )
      );
      setSelectedDeck(null); // Deselect the deck if it was the one being viewed
      setShowDeleteDeckConfirm(false); // Close confirmation modal
      setDeckToDelete(null); // Clear deck to delete state
      console.log('Deck and its cards deleted successfully!');
    } catch (e) {
      console.error('Error deleting deck: ', e);
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
    setAiCopiedText(''); // Clear copied text when starting edit
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

      let promptText = '';
      if (aiCopiedText.trim()) {
        // If copied text is provided, generate Q/A based on it
        promptText = `Generate ${numberOfCardsToGenerate} flashcard questions and answers based on the following text:\n\n"${aiCopiedText}"\n\n`;
        promptText += `Ensure each question is concise and its answer is informative. Format the response as a JSON array of objects, where each object has two keys: "question" (string) and "answer" (string). Example: [{"question": "Q1", "answer": "A1"}, {"question": "Q2", "answer": "A2"}]`;
      } else if (aiSubject.trim()) {
        // Fallback to subject and related topics if no copied text
        promptText = `Generate ${numberOfCardsToGenerate} flashcard questions and answers.
        ${contextPrompt}
        Subject: ${aiSubject}.
        ${aiRelatedTopics ? `Related topics/keywords: ${aiRelatedTopics}.` : ''}
        Ensure each question is concise and its answer is informative.
        Format the response as a JSON array of objects, where each object has two keys: "question" (string) and "answer" (string).
        Example: [{"question": "Q1", "answer": "A1"}, {"question": "Q2", "answer": "A2"}]`;
      } else {
        console.warn(
          'No input provided for AI generation (neither copied text nor subject).'
        );
        setIsGeneratingAIContent(false);
        return;
      }

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

      // Reverted API key declaration as per user's request
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
          // Set the first generated card's content to the inputs, then clear for next manual entry
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
      // Close modal and clear all inputs after AI generation attempt
      setIsAddingCard(false);
      setEditingCard(null); // Ensure editing state is also reset
      setNewCardFront('');
      setNewCardBack('');
      setAiSubject('');
      setAiRelatedTopics('');
      setNumberOfCardsToGenerate(1);
      setAiCopiedText(''); // Clear copied text after generation
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
    // Explicitly check if auth object is available before proceeding
    if (!auth) {
      setAuthError(
        'Authentication service is not fully initialized. Please wait a moment and try again.'
      );
      console.error('Auth object is null during signup attempt.');
      return;
    }
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
      } else if (error.code === 'auth/email-already-in-use') {
        setAuthError(
          'This email is already in use. Please try logging in or use a different email.'
        );
      } else if (error.code === 'auth/weak-password') {
        setAuthError(
          'Password is too weak. Please choose a stronger password.'
        );
      } else {
        setAuthError(error.message);
      }
    }
  };

  const handleLogin = async (email, password) => {
    setAuthError('');
    // Explicitly check if auth object is available before proceeding
    if (!auth) {
      setAuthError(
        'Authentication service is not fully initialized. Please wait a moment and try again.'
      );
      console.error('Auth object is null during login attempt.');
      return;
    }
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
      } else if (error.code === 'auth/user-not-found') {
        setAuthError(
          'No user found with this email. Please sign up or check your email.'
        );
      } else if (error.code === 'auth/wrong-password') {
        setAuthError('Incorrect password. Please try again.');
      } else {
        setAuthError(error.message);
      }
    }
  };

  const handleLogout = async () => {
    // Check auth before attempting logout
    if (!auth) {
      console.error(
        'Auth object is null during logout attempt. Cannot logout.'
      );
      setAuthError(
        'Authentication service is not ready. Cannot log out at this moment.'
      );
      return;
    }
    try {
      await signOut(auth);
      console.log('User logged out successfully!');
      setCurrentPage('home'); // Go to home page after logout
    } catch (error) {
      console.error('Error logging out:', error.code, error.message);
      setAuthError(error.message);
    }
  };

  // Calculate cards for the current page
  const indexOfLastCard = currentCardPage * cardsPerPage;
  const indexOfFirstCard = indexOfLastCard - cardsPerPage;
  const currentCards = cards.slice(indexOfFirstCard, indexOfLastCard);

  // Change page
  const paginate = (pageNumber) => setCurrentCardPage(pageNumber);

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
    <div className='min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 font-inter flex flex-col items-center'>
      {/* Header Section */}
      <header className='w-full bg-white dark:bg-gray-800 shadow-xl p-6 mb-8 flex flex-col sm:flex-row items-center justify-between sticky top-0 z-10 rounded-none'>
        <div className='flex items-center justify-between w-full sm:w-auto'>
          {/* App Name */}
          <div className='flex items-center'>
            {/* Removed logo img tags */}
            <h1 className='text-3xl sm:text-4xl font-extrabold text-indigo-800 dark:text-indigo-400'>
              {' '}
              {/* Decreased text size */}
              Flashcard Pro
            </h1>
          </div>
          {/* Mobile Menu Toggle */}
          <button
            className='sm:hidden p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors'
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className='h-6 w-6' />
            ) : (
              <Menu className='h-6 w-6' />
            )}
          </button>
        </div>

        {/* Navigation and Theme Toggle (Desktop and Mobile) */}
        <nav
          className={`w-full sm:w-auto mt-4 sm:mt-0 ${
            isMobileMenuOpen ? 'block' : 'hidden'
          } sm:block`}
        >
          <div className='flex flex-col sm:flex-row items-center justify-center sm:justify-end gap-3'>
            {/* Navigation Buttons */}
            <button
              onClick={() => {
                setCurrentPage('home');
                setSelectedDeck(null);
                setReviewMode(false);
                setShowDashboard(false);
                setIsMobileMenuOpen(false);
              }}
              className={`flex items-center px-5 py-2.5 rounded-xl shadow-md transition-all duration-300 transform hover:scale-105 font-medium w-full sm:w-auto justify-center
                ${
                  currentPage === 'home'
                    ? 'bg-indigo-700 text-white shadow-lg'
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
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center px-5 py-2.5 rounded-xl shadow-md transition-all duration-300 transform hover:scale-105 font-medium w-full sm:w-auto justify-center
                    ${
                      currentPage === 'dashboard'
                        ? 'bg-purple-700 text-white shadow-lg'
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
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center px-5 py-2.5 rounded-xl shadow-md transition-all duration-300 transform hover:scale-105 font-medium w-full sm:w-auto justify-center
                    ${
                      currentPage === 'decks'
                        ? 'bg-indigo-700 text-white shadow-lg'
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
                className='flex items-center px-5 py-2.5 bg-red-600 text-white rounded-xl shadow-md hover:bg-red-700 transition-all duration-300 transform hover:scale-105 font-medium w-full sm:w-auto justify-center'
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
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center px-5 py-2.5 rounded-xl shadow-md transition-all duration-300 transform hover:scale-105 font-medium w-full sm:w-auto justify-center
                    ${
                      currentPage === 'login'
                        ? 'bg-gray-700 text-white shadow-lg'
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
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center px-5 py-2.5 rounded-xl shadow-md transition-all duration-300 transform hover:scale-105 font-medium w-full sm:w-auto justify-center
                    ${
                      currentPage === 'signup'
                        ? 'bg-gray-700 text-white shadow-lg'
                        : 'bg-gray-600 text-white hover:bg-gray-700'
                    }`}
                >
                  <UserPlus className='mr-2 h-5 w-5' /> Signup
                </button>
              </>
            )}
            {/* Theme Toggle Button */}
            <button
              onClick={() => {
                console.log(
                  'Theme toggle button clicked. Current dark mode state:',
                  isDarkMode
                );
                setIsDarkMode((prevMode) => !prevMode);
              }}
              className='flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300 transform hover:scale-105 font-medium w-full sm:w-auto justify-center'
              title={
                isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'
              }
            >
              {isDarkMode ? (
                <Sun className='h-5 w-5' />
              ) : (
                <Moon className='h-5 w-5' />
              )}
            </button>
          </div>
        </nav>
      </header>

      {/* Auth Error Display */}
      {authError && (
        <div
          className='w-full max-w-7xl bg-red-100 dark:bg-red-900 shadow-lg text-red-700 dark:text-red-200 px-4 py-3 rounded-xl relative mb-6 animate-fade-in'
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

      {/* Add New Deck Modal/Form */}
      {isAddingDeck && (
        <div className='fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in'>
          <div className='bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md'>
            <h2 className='text-2xl font-semibold mb-6 text-gray-900 dark:text-gray-100'>
              Create New Deck
            </h2>
            <input
              type='text'
              placeholder='Enter Deck Name'
              value={newDeckName}
              onChange={(e) => setNewDeckName(e.target.value)}
              className='w-full px-4 py-3 border border-gray-300 dark:border-gray-600 shadow-lg rounded-lg mb-6 focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-lg'
            />
            <div className='flex justify-end space-x-4'>
              <button
                onClick={() => {
                  setIsAddingDeck(false);
                  setNewDeckName(''); // Clear input on cancel
                  setAuthError(''); // Clear any auth errors
                }}
                className='px-6 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200 font-medium shadow-md'
              >
                Cancel
              </button>
              <button
                onClick={addDeck}
                className='px-6 py-2.5 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-colors duration-200 font-medium'
              >
                Create Deck
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Deck Confirmation Modal */}
      {showDeleteDeckConfirm && deckToDelete && (
        <div className='fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in'>
          <div className='bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md'>
            <h2 className='text-2xl font-semibold mb-6 text-gray-900 dark:text-gray-100'>
              Confirm Deletion
            </h2>
            <p className='text-gray-700 dark:text-gray-300 mb-8 text-lg'>
              Are you sure you want to delete the deck "
              <span className='font-bold text-indigo-600 dark:text-indigo-400'>
                {deckToDelete.name}
              </span>
              "? This action cannot be undone and will delete all cards within
              this deck.
            </p>
            <div className='flex justify-end space-x-4'>
              <button
                onClick={() => {
                  setShowDeleteDeckConfirm(false);
                  setDeckToDelete(null);
                }}
                className='px-6 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200 font-medium shadow-md'
              >
                Cancel
              </button>
              <button
                onClick={() => deleteDeck(deckToDelete.id)}
                className='px-6 py-2.5 bg-red-600 text-white rounded-xl shadow-lg hover:bg-red-700 transition-colors duration-200 font-medium'
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area - Conditional Rendering based on currentPage */}
      <main className='w-full max-w-7xl grid grid-cols-1 md:grid-cols-3 gap-8 flex-grow px-4 sm:px-6 md:px-8'>
        {(() => {
          switch (currentPage) {
            case 'home':
              return <HomePage />;
            case 'login':
              return (
                <AuthForm
                  type='login'
                  onAuth={handleLogin}
                  authError={authError}
                  isAuthServiceReady={isAuthServiceReady}
                />
              );
            case 'signup':
              return (
                <AuthForm
                  type='signup'
                  onAuth={handleSignUp}
                  authError={authError}
                  isAuthServiceReady={isAuthServiceReady}
                />
              );
            case 'dashboard':
              // Dashboard content
              return (
                <section className='md:col-span-3 bg-white dark:bg-gray-800 shadow-xl rounded-2xl p-8 animate-fade-in'>
                  <h2 className='text-3xl font-bold mb-8 text-gray-900 dark:text-gray-100 flex items-center'>
                    <LayoutDashboard className='mr-3 h-8 w-8 text-purple-500' />{' '}
                    Overall Dashboard
                  </h2>
                  <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'>
                    <div className='bg-blue-50 dark:bg-blue-900 rounded-xl p-6 text-center shadow-lg flex flex-col items-center justify-center py-8'>
                      <p className='text-5xl font-extrabold text-blue-700 dark:text-blue-300'>
                        {totalDecksOverall}
                      </p>
                      <p className='text-md text-gray-600 dark:text-gray-400 mt-3'>
                        Total Decks
                      </p>
                    </div>
                    <div className='bg-green-50 dark:bg-green-900 rounded-xl p-6 text-center shadow-lg flex flex-col items-center justify-center py-8'>
                      <p className='text-5xl font-extrabold text-green-700 dark:text-green-300'>
                        {totalCardsOverall}
                      </p>
                      <p className='text-md text-gray-600 dark:text-gray-400 mt-3'>
                        Total Cards
                      </p>
                    </div>
                    <div className='bg-red-50 dark:bg-red-900 rounded-xl p-6 text-center shadow-lg flex flex-col items-center justify-center py-8'>
                      <p className='text-5xl font-extrabold text-red-600 dark:text-red-300'>
                        {totalDueCardsOverall}
                      </p>
                      <p className='text-md text-gray-600 dark:text-gray-400 mt-3'>
                        Cards Due Now
                      </p>
                    </div>
                    <div className='bg-purple-50 dark:bg-purple-900 rounded-xl p-6 text-center shadow-lg flex flex-col items-center justify-center py-8'>
                      <p className='text-5xl font-extrabold text-purple-700 dark:text-purple-300'>
                        {totalLearnedCardsOverall}
                      </p>
                      <p className='text-md text-gray-600 dark:text-gray-400 mt-3'>
                        Cards Learned
                      </p>
                    </div>
                  </div>
                  {totalDecksOverall === 0 && (
                    <p className='text-center text-gray-600 dark:text-gray-400 mt-10 text-xl'>
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
                  <section className='md:col-span-1 bg-white dark:bg-gray-800 shadow-xl rounded-2xl p-6 h-fit animate-fade-in'>
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
                        className='flex items-center px-5 py-2.5 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-all duration-300 transform hover:scale-105 mb-6 w-full justify-center font-medium'
                      >
                        <PlusCircle className='mr-2 h-5 w-5' /> Add New Deck
                      </button>
                    ) : (
                      <p className='text-gray-600 dark:text-gray-400 mb-4 text-center'>
                        Log in to create and manage decks.
                      </p>
                    )}
                    {decks.length === 0 ? (
                      <p className='text-gray-600 dark:text-gray-400 text-center'>
                        No decks yet. Add one to get started!
                      </p>
                    ) : (
                      <ul className='space-y-4'>
                        {decks.map((deck) => (
                          <li
                            key={deck.id}
                            className='flex items-center justify-between gap-3'
                          >
                            {' '}
                            {/* Added gap-3 here */}
                            <button
                              onClick={() => {
                                setSelectedDeck(deck);
                                setReviewMode(false);
                              }}
                              className={`flex-grow text-left px-4 py-3 rounded-l-xl
                                ${
                                  selectedDeck?.id === deck.id
                                    ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 font-semibold shadow-inner'
                                    : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 shadow-md'
                                }
                                transition-colors duration-200 transform hover:scale-[1.02] origin-left text-lg`}
                            >
                              <span>{deck.name}</span>
                              <span className='text-sm text-gray-500 dark:text-gray-400 ml-2'>
                                ({deck.cardCount || 0} cards)
                              </span>
                            </button>
                            {userId && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeckToDelete(deck);
                                  setShowDeleteDeckConfirm(true);
                                }}
                                className='p-3 bg-red-100 dark:bg-red-800 text-red-600 dark:text-red-200 rounded-r-xl hover:bg-red-200 dark:hover:bg-red-700 transition-colors transform hover:scale-[1.02] origin-right shadow-md'
                                title='Delete Deck'
                              >
                                <Trash2 className='h-5 w-5' />
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  {/* Card List / Review Section (Right Column) */}
                  <section className='md:col-span-2 bg-white dark:bg-gray-800 shadow-xl rounded-2xl p-8 animate-fade-in'>
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
                                  className='flex items-center px-4 py-2 bg-green-600 text-white rounded-xl shadow-lg hover:bg-green-700 transition-colors duration-300 transform hover:scale-105 text-sm font-medium'
                                >
                                  <PlusCircle className='mr-2 h-4 w-4' /> Add
                                  Card
                                </button>
                                <button
                                  onClick={startReviewSession}
                                  className='flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 transition-colors duration-300 transform hover:scale-105 text-sm font-medium'
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
                              className='flex items-center px-4 py-2 bg-red-600 text-white rounded-xl shadow-lg hover:bg-red-700 transition-colors duration-300 transform hover:scale-105 text-sm font-medium'
                            >
                              <XCircle className='mr-2 h-4 w-4 inline-block' />{' '}
                              End Review
                            </button>
                          )}
                        </h2>

                        {/* User Progress Metrics for the selected deck */}
                        {!reviewMode && (
                          <div className='flex justify-around items-center bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mb-8 shadow-inner'>
                            <div className='text-center'>
                              <p className='text-2xl font-bold text-indigo-600 dark:text-indigo-300'>
                                {selectedDeck.cardCount || 0}
                              </p>
                              <p className='text-sm text-gray-600 dark:text-gray-400 mt-1'>
                                Total Cards
                              </p>
                            </div>
                            <div className='text-center'>
                              <p className='text-2xl font-bold text-red-600 dark:text-red-300'>
                                {dueCardsCount}
                              </p>
                              <p className='text-sm text-gray-600 dark:text-gray-400 mt-1'>
                                Due Now
                              </p>
                            </div>
                            <div className='text-center'>
                              <p className='text-2xl font-bold text-green-600 dark:text-green-300'>
                                {learnedCardsCount}
                              </p>
                              <p className='text-sm text-gray-600 dark:text-gray-400 mt-1'>
                                Cards Learned
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Add/Edit Card Modal/Form */}
                        {(isAddingCard || editingCard) && (
                          <div className='fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in'>
                            <div className='bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-lg max-h-screen overflow-y-auto'>
                              <h2 className='text-2xl font-semibold mb-6 text-gray-900 dark:text-gray-100'>
                                {editingCard ? 'Edit Card' : 'Add New Card'}
                              </h2>
                              <textarea
                                placeholder='Front of card (Question)'
                                value={newCardFront}
                                onChange={(e) =>
                                  setNewCardFront(e.target.value)
                                }
                                className='w-full px-4 py-3 border border-gray-300 dark:border-gray-600 shadow-lg rounded-lg mb-4 focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-y placeholder-gray-500 dark:placeholder-gray-400 text-lg'
                                rows='3'
                              ></textarea>
                              <textarea
                                placeholder='Back of card (Answer)'
                                value={newCardBack}
                                onChange={(e) => setNewCardBack(e.target.value)}
                                className='w-full px-4 py-3 border border-gray-300 dark:border-gray-600 shadow-lg rounded-lg mb-6 focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-y placeholder-gray-500 dark:placeholder-400 text-lg'
                                rows='3'
                              ></textarea>

                              {/* AI Content Generation Inputs */}
                              <div className='mt-4 border-t border-gray-200 dark:border-gray-600 pt-6'>
                                <p className='text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100 flex items-center'>
                                  <Brain className='mr-2 h-5 w-5 text-purple-500' />{' '}
                                  Generate with AI:
                                </p>
                                <textarea
                                  placeholder='Paste text here for AI to generate Q/A from (e.g., notes, article snippets)'
                                  value={aiCopiedText}
                                  onChange={(e) => {
                                    setAiCopiedText(e.target.value);
                                    // Clear subject/topics if user starts pasting text
                                    if (e.target.value.trim()) {
                                      setAiSubject('');
                                      setAiRelatedTopics('');
                                    }
                                  }}
                                  className='w-full px-4 py-3 border border-gray-300 dark:border-gray-600 shadow-lg rounded-lg mb-4 focus:ring-2 focus:ring-purple-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-y placeholder-gray-500 dark:placeholder-gray-400 text-lg'
                                  rows='4'
                                ></textarea>
                                <p className='text-sm text-gray-600 dark:text-gray-400 mb-4 text-center'>
                                  OR
                                </p>
                                <input
                                  type='text'
                                  placeholder="Subject (e.g., 'History of Rome')"
                                  value={aiSubject}
                                  onChange={(e) => {
                                    setAiSubject(e.target.value);
                                    // Clear copied text if user starts typing subject
                                    if (e.target.value.trim()) {
                                      setAiCopiedText('');
                                    }
                                  }}
                                  className='w-full px-4 py-3 border border-gray-300 dark:border-gray-600 shadow-lg rounded-lg mb-4 focus:ring-2 focus:ring-purple-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-lg'
                                />
                                <textarea
                                  placeholder="Related topics (comma-separated, e.g., 'Julius Caesar, Roman Empire')"
                                  value={aiRelatedTopics}
                                  onChange={(e) =>
                                    setAiRelatedTopics(e.target.value)
                                  }
                                  className='w-full px-4 py-3 border border-gray-300 dark:border-gray-600 shadow-lg rounded-lg mb-4 focus:ring-2 focus:ring-purple-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-y placeholder-gray-500 dark:placeholder-gray-400 text-lg'
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
                                  className='w-full px-4 py-3 border border-gray-300 dark:border-gray-600 shadow-lg rounded-lg mb-6 focus:ring-2 focus:ring-purple-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-lg'
                                />
                              </div>

                              {/* AI Generation Button */}
                              <button
                                onClick={generateCardContentWithAI}
                                disabled={
                                  isGeneratingAIContent ||
                                  (!aiSubject.trim() && !aiCopiedText.trim())
                                }
                                className={`flex items-center justify-center w-full px-6 py-3 rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 mb-6 font-medium text-lg
                                  ${
                                    isGeneratingAIContent ||
                                    (!aiSubject.trim() && !aiCopiedText.trim())
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
                                    <Sparkles className='mr-2 h-5 w-5' />{' '}
                                    Generate with AI
                                  </>
                                )}
                              </button>

                              <div className='flex justify-end space-x-4'>
                                <button
                                  onClick={() => {
                                    setIsAddingCard(false);
                                    setEditingCard(null);
                                    setNewCardFront('');
                                    setNewCardBack('');
                                    setAiSubject('');
                                    setAiRelatedTopics('');
                                    setNumberOfCardsToGenerate(1);
                                    setAiCopiedText('');
                                  }}
                                  className='px-6 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200 font-medium shadow-md'
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
                                    setAiCopiedText('');
                                  }}
                                  className='px-6 py-2.5 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-colors duration-200 font-medium'
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
                                viewMode={cardViewMode} // Pass view mode to Flashcard component
                              />
                              <div className='mt-6 text-center text-gray-600 dark:text-gray-400 text-lg'>
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
                                className='mt-6 px-6 py-2.5 bg-red-600 text-white rounded-xl shadow-lg hover:bg-red-700 transition-colors duration-300 transform hover:scale-105 font-medium'
                              >
                                <XCircle className='mr-2 h-4 w-4 inline-block' />{' '}
                                End Review
                              </button>
                            </div>
                          )
                        ) : // Card List UI
                        cards.length === 0 ? (
                          <p className='text-gray-600 dark:text-gray-400 text-center'>
                            No cards in this deck. Add one!
                          </p>
                        ) : (
                          <>
                            {/* View Mode Toggle Buttons */}
                            <div className='flex justify-end mb-4 space-x-2'>
                              <button
                                onClick={() => setCardViewMode('grid')}
                                className={`p-2 rounded-xl transition-colors ${
                                  cardViewMode === 'grid'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 shadow-md'
                                }`}
                                title='Grid View'
                              >
                                <Grid className='h-5 w-5' />
                              </button>
                              <button
                                onClick={() => setCardViewMode('list')}
                                className={`p-2 rounded-xl transition-colors ${
                                  cardViewMode === 'list'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 shadow-md'
                                }`}
                                title='List View'
                              >
                                <List className='h-5 w-5' />
                              </button>
                            </div>

                            <div
                              className={`${
                                cardViewMode === 'grid'
                                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6'
                                  : 'space-y-4'
                              }`}
                            >
                              {currentCards.map((card) => (
                                <Flashcard
                                  key={card.id}
                                  card={card}
                                  onDelete={() => deleteCard(card.id)}
                                  onEdit={() => startEditCard(card)}
                                  isReviewMode={false}
                                  viewMode={cardViewMode} // Pass view mode to Flashcard component
                                />
                              ))}
                            </div>

                            {/* Pagination Controls */}
                            {cards.length > cardsPerPage && (
                              <div className='flex justify-center mt-8 space-x-2'>
                                {Array.from(
                                  {
                                    length: Math.ceil(
                                      cards.length / cardsPerPage
                                    ),
                                  },
                                  (_, i) => (
                                    <button
                                      key={i + 1}
                                      onClick={() => paginate(i + 1)}
                                      className={`px-4 py-2 rounded-xl font-medium transition-colors duration-200
                                        ${
                                          currentCardPage === i + 1
                                            ? 'bg-indigo-600 text-white shadow-lg'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 shadow-md'
                                        }`}
                                    >
                                      {i + 1}
                                    </button>
                                  )
                                )}
                              </div>
                            )}
                          </>
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
      <footer className='w-full bg-white dark:bg-gray-800 shadow-xl mt-12 text-center text-gray-600 dark:text-gray-400 text-sm py-4 rounded-none'>
        <p>
          &copy; {new Date().getFullYear()} Flashcard Pro. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

// --- HomePage Component ---
const HomePage = () => {
  return (
    <section className='md:col-span-3 bg-white dark:bg-gray-800 shadow-xl rounded-2xl p-8 text-center animate-fade-in'>
      {/* Hero Section */}
      <div className='bg-gradient-to-r from-indigo-600 to-purple-700 text-white rounded-xl p-10 mb-10 shadow-2xl'>
        <h2 className='text-5xl md:text-6xl font-extrabold mb-5 leading-tight tracking-tight'>
          Master Anything with Flashcard Pro!
        </h2>
        <p className='text-xl md:text-2xl mb-8 opacity-95 max-w-3xl mx-auto'>
          Your intelligent companion for effective learning and lasting memory.
        </p>
        <div className='flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-6'>
          <a
            href='#get-started' // Scroll to "Ready to start learning?" section
            className='inline-flex items-center px-8 py-4 bg-white text-indigo-700 font-bold rounded-xl shadow-lg hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 text-lg'
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById('get-started')
                .scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <PlayCircle className='mr-3 h-6 w-6' /> Get Started Now
          </a>
        </div>
      </div>

      <h3 className='text-4xl font-bold text-gray-900 dark:text-gray-100 mb-10'>
        Why Choose Flashcard Pro?
      </h3>

      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-left mb-16'>
        {/* Feature 1: Spaced Repetition */}
        <div className='bg-gray-50 dark:bg-gray-700 p-7 rounded-xl shadow-inner flex flex-col items-center text-center'>
          <Brain className='text-blue-600 dark:text-blue-300 mb-5 h-14 w-14' />
          <h4 className='text-2xl font-bold text-blue-700 dark:text-blue-300 mb-3'>
            Smart Learning with SRS
          </h4>
          <p className='text-gray-800 dark:text-gray-200 text-lg'>
            Utilize the proven SM-2 spaced repetition algorithm to review cards
            at optimal intervals, maximizing retention and minimizing study
            time.
          </p>
        </div>

        {/* Feature 2: AI Content Generation */}
        <div className='bg-gray-50 dark:bg-gray-700 p-7 rounded-xl shadow-inner flex flex-col items-center text-center'>
          <Sparkles className='text-purple-600 dark:text-purple-300 mb-5 h-14 w-14' />
          <h4 className='text-2xl font-bold text-purple-700 dark:text-purple-300 mb-3'>
            AI-Powered Card Creation
          </h4>
          <p className='text-gray-800 dark:text-gray-200 text-lg'>
            Effortlessly generate flashcard questions and answers on any subject
            with our integrated Google Gemini AI, saving you time and boosting
            creativity.
          </p>
        </div>

        {/* Feature 3: Organized Deck & Card Management */}
        <div className='bg-gray-50 dark:bg-gray-700 p-7 rounded-xl shadow-inner flex flex-col items-center text-center'>
          <FolderDot className='text-green-600 dark:text-green-300 mb-5 h-14 w-14' />
          <h4 className='text-2xl font-bold text-green-700 dark:text-green-300 mb-3'>
            Intuitive Organization
          </h4>
          <p className='text-gray-800 dark:text-gray-200 text-lg'>
            Create, manage, and categorize your flashcards into custom decks,
            keeping your study materials perfectly organized and accessible.
          </p>
        </div>

        {/* Feature 4: Progress Tracking */}
        <div className='bg-gray-50 dark:bg-gray-700 p-7 rounded-xl shadow-inner flex flex-col items-center text-center'>
          <TrendingUp className='text-orange-600 dark:text-orange-300 mb-5 h-14 w-14' />
          <h4 className='text-2xl font-bold text-orange-700 dark:text-orange-300 mb-3'>
            Track Your Growth
          </h4>
          <p className='text-gray-800 dark:text-gray-200 text-lg'>
            Monitor your learning progress with real-time statistics, including
            total decks, cards, and cards due, helping you stay motivated.
          </p>
        </div>

        {/* Feature 5: Responsive & Real-time */}
        <div className='bg-gray-50 dark:bg-gray-700 p-7 rounded-xl shadow-inner flex flex-col items-center text-center'>
          <Zap className='text-red-600 dark:text-red-300 mb-5 h-14 w-14' />
          <h4 className='text-2xl font-bold text-red-700 dark:text-red-300 mb-3'>
            Seamless & Responsive
          </h4>
          <p className='text-gray-800 dark:text-gray-200 text-lg'>
            Enjoy a fluid experience on any device with our responsive design
            and real-time data synchronization powered by Firebase.
          </p>
        </div>

        {/* Feature 6: Secure & Reliable */}
        <div className='bg-gray-50 dark:bg-gray-700 p-7 rounded-xl shadow-inner flex flex-col items-center text-center'>
          <User className='text-indigo-600 dark:text-indigo-300 mb-5 h-14 w-14' />
          <h4 className='text-2xl font-bold text-indigo-700 dark:text-indigo-300 mb-3'>
            Secure User Experience
          </h4>
          <p className='text-gray-800 dark:text-gray-200 text-lg'>
            Your data is safe with robust Firebase Authentication and Firestore,
            ensuring a secure and reliable learning environment.
          </p>
        </div>
      </div>

      <h3 className='text-4xl font-bold text-gray-900 dark:text-gray-100 mb-10'>
        What's Next for Flashcard Pro?
      </h3>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-8 text-left mb-16'>
        <div className='bg-gray-50 dark:bg-gray-700 p-6 rounded-xl shadow-inner flex items-start'>
          <Sparkles className='text-purple-500 mr-4 mt-1 h-7 w-7 flex-shrink-0' />
          <div>
            <h4 className='text-2xl font-bold text-purple-600 dark:text-purple-300 mb-3'>
              Enhanced AI Capabilities
            </h4>
            <ul className='list-none text-gray-800 dark:text-gray-200 space-y-2 text-lg'>
              <li>
                <Lightbulb className='inline-block h-5 w-5 mr-2 text-purple-400' />{' '}
                <strong className='font-bold'>Smart Suggestions</strong> -
                AI-driven hints for card answers during creation.
              </li>
              <li>
                <FileText className='inline-block h-5 w-5 mr-2 text-purple-400' />{' '}
                <strong className='font-bold'>Content Summarization</strong> -
                Generate concise flashcards from longer texts.
              </li>
              <li>
                <Compass className='inline-block h-5 w-5 mr-2 text-purple-400' />{' '}
                <strong className='font-bold'>Adaptive Learning Paths</strong> -
                AI-powered personalized study recommendations.
              </li>
            </ul>
          </div>
        </div>
        <div className='bg-gray-50 dark:bg-gray-700 p-6 rounded-xl shadow-inner flex items-start'>
          <Settings className='text-orange-500 mr-4 mt-1 h-7 w-7 flex-shrink-0' />
          <div>
            <h4 className='text-2xl font-bold text-orange-600 dark:text-orange-300 mb-3'>
              Prospective Enhancements
            </h4>
            <ul className='list-none text-gray-800 dark:text-gray-200 space-y-2 text-lg'>
              <li>
                <FileText className='inline-block h-5 w-5 mr-2 text-orange-400' />{' '}
                <strong className='font-bold'>Deck Import/Export</strong> -
                Share and backup your decks easily.
              </li>
              <li>
                <Share2 className='inline-block h-5 w-5 mr-2 text-orange-400' />{' '}
                <strong className='font-bold'>Deck Sharing</strong> -
                Collaborate or share knowledge with others.
              </li>
              <li>
                <Type className='inline-block h-5 w-5 mr-2 text-orange-400' />{' '}
                <strong className='font-bold'>Rich Text Editor</strong> - Format
                card content with bold, italics, and more.
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div
        id='get-started'
        className='mt-12 text-xl text-gray-700 dark:text-gray-300'
      >
        <p className='mb-5'>Ready to revolutionize your learning journey?</p>
        <p className='font-extrabold text-indigo-700 dark:text-indigo-400 text-2xl'>
          Login or Sign Up to create your first deck and experience the power of
          Flashcard Pro!
        </p>
      </div>
    </section>
  );
};

// --- AuthForm Component ---
const AuthForm = ({ type, onAuth, authError, isAuthServiceReady }) => {
  // Added isAuthServiceReady prop
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');

  // Clear local message when authError prop changes from parent
  useEffect(() => {
    if (authError) {
      setMessage(authError);
    } else {
      setMessage('');
    }
  }, [authError]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setMessage(''); // Clear previous local messages
    if (type === 'signup' && password !== confirmPassword) {
      setMessage('Passwords do not match!');
      return;
    }
    onAuth(email, password);
  };

  return (
    <section className='md:col-span-3 flex items-center justify-center p-4 animate-fade-in'>
      <div className='bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-10 w-full max-w-md'>
        <h2 className='text-3xl font-bold mb-8 text-center text-gray-900 dark:text-gray-100'>
          {type === 'login' ? 'Login to Your Account' : 'Create Your Account'}
        </h2>
        {message && (
          <div
            className='bg-red-100 dark:bg-red-900 shadow-lg text-red-700 dark:text-red-200 px-4 py-3 rounded-lg mb-6 animate-fade-in'
            role='alert'
          >
            {message}
          </div>
        )}
        <form onSubmit={handleSubmit} className='space-y-6'>
          <div>
            <label
              htmlFor='email'
              className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
            >
              Email Address
            </label>
            <input
              type='email'
              id='email'
              placeholder='your.email@example.com'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className='w-full px-4 py-3 border border-gray-300 dark:border-gray-600 shadow-lg rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-lg'
            />
          </div>
          <div>
            <label
              htmlFor='password'
              className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
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
              className='w-full px-4 py-3 border border-gray-300 dark:border-gray-600 shadow-lg rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-lg'
            />
          </div>
          {type === 'signup' && (
            <div>
              <label
                htmlFor='confirm-password'
                className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
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
                className='w-full px-4 py-3 border border-gray-300 dark:border-gray-600 shadow-lg rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-lg'
              />
            </div>
          )}
          <button
            type='submit'
            disabled={!isAuthServiceReady} // Disable button until auth service is ready
            className={`w-full px-6 py-3 rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 font-semibold text-lg
              ${
                isAuthServiceReady
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-gray-400 text-gray-700 cursor-not-allowed'
              }`}
          >
            {type === 'login' ? 'Login' : 'Sign Up'}
          </button>
        </form>
      </div>
    </section>
  );
};

// --- Flashcard Component ---
const Flashcard = ({
  card,
  onDelete,
  onEdit,
  isReviewMode,
  onReview,
  viewMode,
}) => {
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

  const cardBaseClasses =
    'relative bg-white dark:bg-gray-700 rounded-xl shadow-lg p-6 cursor-pointer transform transition-all duration-300 hover:scale-[1.02] flex justify-between'; // Added shadow-lg
  const cardHeightClass = 'min-h-[180px]'; // Default height for grid view

  const cardListClasses = 'flex-row items-center p-4 min-h-[auto] !h-auto'; // Adjusted for list view
  const cardGridClasses = 'flex-col ' + cardHeightClass; // Adjusted for grid view

  return (
    <div
      className={`${cardBaseClasses} ${
        viewMode === 'list' ? cardListClasses : cardGridClasses
      }`}
      onClick={() => isReviewMode && setIsFlipped(!isFlipped)}
    >
      <div className='text-lg font-medium text-gray-900 dark:text-gray-100 flex-grow'>
        {isFlipped ? card.back : card.front}
        {!isReviewMode && card.nextReviewDate && viewMode === 'list' && (
          <div
            className={`text-xs flex items-center mt-1 ${reviewDateColorClass}`}
          >
            {ReviewIcon && <ReviewIcon className='h-3 w-3 mr-1' />}
            <span className='ml-1'>Next Review:</span> {reviewDateText}
          </div>
        )}
      </div>

      {!isReviewMode && (
        <div
          className={`flex space-x-2 ${
            viewMode === 'list' ? 'ml-auto' : 'absolute bottom-3 right-3'
          }`}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className='p-2 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors shadow-md'
            title='Edit Card'
          >
            <Edit className='h-4 w-4' />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className='p-2 rounded-full bg-red-100 dark:bg-red-800 text-red-600 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-700 transition-colors shadow-md'
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
            className='flex items-center px-2 py-2 sm:px-3 bg-gray-500 text-white rounded-lg shadow-lg hover:bg-gray-600 transition-colors transform hover:scale-105 text-sm'
          >
            <RotateCcw className='mr-1 h-4 w-4' /> Again
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReview(card, 1);
            }}
            className='flex items-center px-2 py-2 sm:px-3 bg-red-500 text-white rounded-lg shadow-lg hover:bg-red-600 transition-colors transform hover:scale-105 text-sm'
          >
            <XCircle className='mr-1 h-4 w-4' /> Hard
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReview(card, 3);
            }}
            className='flex items-center px-2 py-2 sm:px-3 bg-yellow-500 text-white rounded-lg shadow-lg hover:bg-yellow-600 transition-colors transform hover:scale-105 text-sm'
          >
            <Clock className='mr-1 h-4 w-4' /> Good
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReview(card, 5);
            }}
            className='flex items-center px-2 py-2 sm:px-3 bg-green-500 text-white rounded-lg shadow-lg hover:bg-green-600 transition-colors transform hover:scale-105 text-sm'
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
      {!isReviewMode && card.nextReviewDate && viewMode === 'grid' && (
        <div
          className={`absolute bottom-3 left-3 text-xs flex items-center ${reviewDateColorClass}`}
        >
          {ReviewIcon && <ReviewIcon className='h-3 w-3 mr-1' />}
          <span className='ml-1'>Next Review:</span> {reviewDateText}
        </div>
      )}
    </div>
  );
};

export default App;
