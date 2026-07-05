import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  TrendingUp,
  Award,
  MessageSquare,
  Search,
  CheckCircle2,
  Clock,
  Compass,
  Activity,
  X,
  ThumbsUp,
  ThumbsDown,
  Plus,
  MapPin,
  Camera,
  Bot,
  Send,
  LogOut,
  User,
  Building2,
  Landmark,
  Globe,
  Gift,
  Edit3,
  Save,
  FileText,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import maplibregl from 'maplibre-gl';
import { GEMINI_API_KEYS } from './config/geminiKeys';
import { io, Socket } from 'socket.io-client';

// Import MapLibre GL CSS to ensure maps render correctly instead of staying blank
import 'maplibre-gl/dist/maplibre-gl.css';

const BACKEND_BASE_URL = 'http://localhost:3000';
const SPATIAL_SERVICE_BASE_URL = 'http://localhost:8001';

// --- Types ---
type UserRole = 'citizen' | 'company' | 'government';

interface AppUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
}

interface Comment {
  id?: string;
  author: string;
  text: string;
  created_at: string;
}

interface IssueReport {
  id: string;
  category: string;
  severity: string;
  status: string;
  latitude: number;
  longitude: number;
  s3_media_url: string | null;
  original_media_url: string | null;
  upvotes: number;
  downvotes: number;
  created_at: string;
  comments: Comment[];
  description?: string;
  colony_area?: string; // New field for colonies (e.g. Subhash Nagar, Bharatpur)
  reporter_name?: string; // New field to match reports with their creator
}

interface LeaderboardUser {
  rank: number;
  name: string;
  points: number;
  badges: string[];
  avatarColor: string;
}

interface MapSearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface RewardedCandidate {
  name: string;
  verifiedReports: number;
  rewardsClaimed: number;
  avatarColor: string;
}

interface OngoingRepair {
  title: string;
  location: string;
  beforeUrl: string;
  afterUrl: string;
  status: string;
}

const MOCK_TOP_PERFORMERS = {
  sector: [
    { rank: 1, name: "Sector 15, Noida", rate: "94%", count: "128 resolved / 136 total" },
    { rank: 2, name: "Connaught Place, New Delhi", rate: "89%", count: "245 resolved / 275 total" },
    { rank: 3, name: "HSR Layout, Bengaluru", rate: "85%", count: "198 resolved / 233 total" },
    { rank: 4, name: "Salt Lake Sector V, Kolkata", rate: "81%", count: "142 resolved / 175 total" },
    { rank: 5, name: "Gachibowli, Hyderabad", rate: "79%", count: "310 resolved / 392 total" },
  ],
  city: [
    { rank: 1, name: "Indore, Madhya Pradesh", rate: "96%", count: "2,450 resolved / 2,552 total" },
    { rank: 2, name: "Surat, Gujarat", rate: "92%", count: "3,120 resolved / 3,391 total" },
    { rank: 3, name: "Navi Mumbai, Maharashtra", rate: "90%", count: "1,890 resolved / 2,100 total" },
    { rank: 4, name: "Ambikapur, Chhattisgarh", rate: "88%", count: "780 resolved / 886 total" },
    { rank: 5, name: "Mysuru, Karnataka", rate: "87%", count: "1,240 resolved / 1,425 total" },
  ],
  state: [
    { rank: 1, name: "Sikkim", rate: "95%", count: "3,890 resolved / 4,095 total" },
    { rank: 2, name: "Goa", rate: "91%", count: "5,120 resolved / 5,626 total" },
    { rank: 3, name: "Himachal Pradesh", rate: "88%", count: "12,450 resolved / 14,148 total" },
    { rank: 4, name: "Gujarat", rate: "86%", count: "48,900 resolved / 56,860 total" },
    { rank: 5, name: "Tamil Nadu", rate: "84%", count: "62,310 resolved / 74,178 total" },
  ]
};

// --- Initial Test Users ---
const INITIAL_USERS: AppUser[] = [
  { id: 'user-1', name: 'Rahul Sharma', email: 'citizen@test.com', password: 'test123', role: 'citizen' },
  { id: 'user-2', name: 'Tata Infrastructure', email: 'company@test.com', password: 'test123', role: 'company' },
  { id: 'user-3', name: 'Municipal Officer', email: 'gov@test.com', password: 'test123', role: 'government' },
];

// --- Mock Data (Indian Cities & Colonies) ---
const MOCK_REPORTS: IssueReport[] = [
  {
    id: 'report-1',
    category: 'Pothole',
    severity: 'Severe',
    status: 'Verified',
    latitude: 28.6139,
    longitude: 77.2090,
    original_media_url: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=800&q=80',
    s3_media_url: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=800&q=80&blur=30',
    upvotes: 18,
    downvotes: 2,
    created_at: '2026-06-27T10:30:00Z',
    description: 'Deep pothole causing accidents near CP block B.',
    colony_area: 'Connaught Place, New Delhi',
    reporter_name: 'Rahul Sharma',
    comments: [
      { author: 'Rahul Sharma', text: 'Almost broke my axle here this morning. Be careful!', created_at: '2026-06-27T11:00:00Z' },
      { author: 'NDMC Inspector', text: 'Report routed to road maintenance crew.', created_at: '2026-06-27T12:15:00Z' }
    ]
  },
  {
    id: 'report-2',
    category: 'Waste',
    severity: 'Medium',
    status: 'Reported',
    latitude: 19.0760,
    longitude: 72.8777,
    original_media_url: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=800&q=80',
    s3_media_url: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=800&q=80&blur=20',
    upvotes: 5,
    downvotes: 0,
    created_at: '2026-06-27T14:20:00Z',
    description: 'Illegal dumping of plastic bags near Juhu shoreline.',
    colony_area: 'Juhu Scheme, Mumbai',
    reporter_name: 'Rahul Sharma',
    comments: []
  },
  {
    id: 'report-3',
    category: 'Water Leak',
    severity: 'Severe',
    status: 'Resolved',
    latitude: 12.9716,
    longitude: 77.5946,
    original_media_url: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80',
    s3_media_url: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80&blur=15',
    upvotes: 32,
    downvotes: 1,
    created_at: '2026-06-26T08:15:00Z',
    description: 'Large municipal pipeline burst. Water flooding street.',
    colony_area: 'MG Road Metro Station, Bangalore',
    reporter_name: 'Priya Sharma',
    comments: [
      { author: 'Priya Nair', text: 'Clean-up complete, water shut-off resolved.', created_at: '2026-06-26T16:00:00Z' }
    ]
  },
  {
    id: 'report-4',
    category: 'Broken Infrastructure',
    severity: 'Minor',
    status: 'Reported',
    latitude: 26.9124,
    longitude: 75.7873,
    original_media_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
    s3_media_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80&blur=25',
    upvotes: 3,
    downvotes: 0,
    created_at: '2026-06-27T16:10:00Z',
    description: 'Streetlight pole tilted and sparking.',
    colony_area: 'Subhash Nagar, Jaipur',
    reporter_name: 'Vikram Singh',
    comments: []
  }
];

// --- Leaderboard Mock Data (For Filters) ---
const MOCK_LEADERBOARDS: Record<'daily' | 'weekly' | 'monthly' | 'overall', LeaderboardUser[]> = {
  daily: [
    { rank: 1, name: 'Arjun Patel', points: 150, badges: ['First Reporter'], avatarColor: 'bg-zinc-900' },
    { rank: 2, name: 'Vikram Singh', points: 120, badges: ['Neighbourhood Guardian'], avatarColor: 'bg-zinc-700' },
    { rank: 3, name: 'Priya Sharma', points: 80, badges: ['Pothole Patrol'], avatarColor: 'bg-zinc-800' }
  ],
  weekly: [
    { rank: 1, name: 'Arjun Patel', points: 450, badges: ['First Reporter', 'Pothole Patrol'], avatarColor: 'bg-zinc-900' },
    { rank: 2, name: 'Priya Sharma', points: 380, badges: ['Community Hero'], avatarColor: 'bg-zinc-800' },
    { rank: 3, name: 'Vikram Singh', points: 340, badges: ['Neighbourhood Guardian'], avatarColor: 'bg-zinc-700' },
    { rank: 4, name: 'Ananya Gupta', points: 210, badges: ['Neighbourhood Watch'], avatarColor: 'bg-zinc-600' }
  ],
  monthly: [
    { rank: 1, name: 'Arjun Patel', points: 950, badges: ['City Legend', 'Community Hero'], avatarColor: 'bg-zinc-900' },
    { rank: 2, name: 'Priya Sharma', points: 820, badges: ['Community Hero', 'Pothole Patrol'], avatarColor: 'bg-zinc-800' },
    { rank: 3, name: 'Vikram Singh', points: 640, badges: ['Neighbourhood Guardian'], avatarColor: 'bg-zinc-700' },
    { rank: 4, name: 'Ananya Gupta', points: 450, badges: ['Neighbourhood Watch'], avatarColor: 'bg-zinc-600' },
    { rank: 5, name: 'Rohan Desai', points: 320, badges: ['First Reporter'], avatarColor: 'bg-zinc-500' }
  ],
  overall: [
    { rank: 1, name: 'Arjun Patel', points: 1250, badges: ['City Legend', 'Community Hero'], avatarColor: 'bg-zinc-900' },
    { rank: 2, name: 'Priya Sharma', points: 980, badges: ['Community Hero', 'Pothole Patrol'], avatarColor: 'bg-zinc-800' },
    { rank: 3, name: 'Vikram Singh', points: 740, badges: ['Neighbourhood Guardian', 'First Reporter'], avatarColor: 'bg-zinc-700' },
    { rank: 4, name: 'Ananya Gupta', points: 510, badges: ['Neighbourhood Watch'], avatarColor: 'bg-zinc-600' },
    { rank: 5, name: 'Rohan Desai', points: 430, badges: ['First Reporter'], avatarColor: 'bg-zinc-500' }
  ]
};

// --- Mock Ongoing Work & Rewarded Candidates ---
const MOCK_ONGOING_REPAIRS: OngoingRepair[] = [
  {
    title: 'Connaught Place Pothole Paving',
    location: 'New Delhi',
    beforeUrl: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=400&q=80',
    afterUrl: 'https://images.unsplash.com/photo-1599740831464-5eecfa64b8a5?auto=format&fit=crop&w=400&q=80',
    status: 'Completed'
  },
  {
    title: 'Juhu Beach Garbage Clean-up Drive',
    location: 'Mumbai',
    beforeUrl: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=400&q=80',
    afterUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80',
    status: 'In Progress'
  }
];

const MOCK_REWARDED_CANDIDATES: RewardedCandidate[] = [
  { name: 'Arjun Patel', verifiedReports: 24, rewardsClaimed: 2000, avatarColor: 'bg-zinc-900' },
  { name: 'Priya Sharma', verifiedReports: 18, rewardsClaimed: 1000, avatarColor: 'bg-zinc-800' },
  { name: 'Vikram Singh', verifiedReports: 11, rewardsClaimed: 1000, avatarColor: 'bg-zinc-700' }
];

export default function App() {
  // --- Auth State ---
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [mockUsers, setMockUsers] = useState<AppUser[]>(INITIAL_USERS);
  const [authName, setAuthName] = useState<string>('');
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authRole, setAuthRole] = useState<UserRole>('citizen');
  const [authError, setAuthError] = useState<string>('');
  // MFA state for government accounts
  const [mfaStep, setMfaStep] = useState<boolean>(false);
  const [mfaCode, setMfaCode] = useState<string>('');
  const [mfaPendingUser, setMfaPendingUser] = useState<AppUser | null>(null);

  // --- Dashboard State ---
  const [activeTab, setActiveTab] = useState<'map' | 'leaderboard' | 'analytics'>('map');
  const [reports, setReports] = useState<IssueReport[]>(MOCK_REPORTS);
  const [selectedReport, setSelectedReport] = useState<IssueReport | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showBlurOriginal, setShowBlurOriginal] = useState<boolean>(false);
  const [commentInput, setCommentInput] = useState<string>('');
  const [votedReports, setVotedReports] = useState<Set<string>>(new Set());

  // --- Leaderboard filter state ---
  const [leaderboardFilter, setLeaderboardFilter] = useState<'daily' | 'weekly' | 'monthly' | 'overall'>('overall');

  // --- Chatbot State ---
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatbotLanguage, setChatbotLanguage] = useState<'EN' | 'HI'>('EN');
  const [chatMessages, setChatMessages] = useState<{ sender: 'bot' | 'user'; text: string; options?: string[] }[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [chatStep, setChatStep] = useState<number>(0);
  const [chatDraftReport, setChatDraftReport] = useState<Partial<IssueReport>>({});
  const [verificationState, setVerificationState] = useState<{
    isOpen: boolean;
    status: 'idle' | 'scanning' | 'category' | 'location' | 'success' | 'failed';
    errorMsg?: string;
  }>({ isOpen: false, status: 'idle' });
  const [pendingReportData, setPendingReportData] = useState<IssueReport | null>(null);

  const [backendConnected, setBackendConnected] = useState<boolean>(false);

  // --- Reporting Form State ---
  const [showReportForm, setShowReportForm] = useState<boolean>(false);
  const [formCategory, setFormCategory] = useState<string>('Pothole');
  const [formSeverity, setFormSeverity] = useState<string>('Medium');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formColonyArea, setFormColonyArea] = useState<string>('');
  const [formLatitude, setFormLatitude] = useState<string>('28.6139');
  const [formLongitude, setFormLongitude] = useState<string>('77.2090');
  const [formPhoto, setFormPhoto] = useState<string | null>(null);

  // --- Map Search State ---
  const [mapSearchQuery, setMapSearchQuery] = useState<string>('');
  const [mapSearchResults, setMapSearchResults] = useState<MapSearchResult[]>([]);

  // --- Resolution State ---
  const [resolvePhoto, setResolvePhoto] = useState<string | null>(null);

  // --- Profile State ---
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [profileName, setProfileName] = useState<string>('');
  const [profileEmail, setProfileEmail] = useState<string>('');

  // --- Leaderboard Section 2 State ---
  const [topPerformersType, setTopPerformersType] = useState<'sector' | 'city' | 'state'>('sector');

  // Sync profile editing fields when modal opens or user changes
  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.name);
      setProfileEmail(currentUser.email);
    }
  }, [currentUser, isProfileOpen]);

  // Dynamic calculation for Civic Reward Scheme values
  const getRewardProgressAndClaimAmount = () => {
    if (!currentUser) return { count: 0, progress: 0, claimed: 0 };
    const dynamicVerifiedCount = reports.filter(
      r => r.reporter_name === currentUser.name && (r.status === 'Verified' || r.status === 'Resolved')
    ).length;

    const mockCandidate = MOCK_REWARDED_CANDIDATES.find(c => c.name.toLowerCase() === currentUser.name.toLowerCase());
    const mockVerified = mockCandidate ? mockCandidate.verifiedReports : 0;

    const totalVerified = dynamicVerifiedCount + mockVerified;
    const progress = totalVerified % 10;
    const claimed = Math.floor(totalVerified / 10) * 1000;
    return { count: totalVerified, progress, claimed };
  };

  const { progress: claimProgress, claimed: totalClaimed } = getRewardProgressAndClaimAmount();

  const isGuest = currentUser?.email === 'guest@communityhero.org';

  const startReportVerification = (report: IssueReport, onComplete?: (success: boolean) => void) => {
    const desc = (report.description || '').toLowerCase().trim();
    const isGibberish = desc.length < 5 || desc === 'good' || desc === 'yup' || desc === 'hlo' || desc === 'hello' || desc === 'hlo buddy';

    setVerificationState({ isOpen: true, status: 'scanning' });
    setPendingReportData(report);

    setTimeout(() => {
      if (isGibberish) {
        setVerificationState({
          isOpen: true,
          status: 'failed',
          errorMsg: 'Description is too brief or lacks civic problem context.'
        });
        if (onComplete) onComplete(false);
        return;
      }
      
      setVerificationState(prev => ({ ...prev, status: 'category' }));
      
      setTimeout(() => {
        setVerificationState(prev => ({ ...prev, status: 'location' }));
        
        setTimeout(() => {
          setVerificationState(prev => ({ ...prev, status: 'success' }));
          
          setReports(prev => [report, ...prev]);
          if (map.current) {
            map.current.flyTo({ center: [report.longitude, report.latitude], zoom: 14 });
          }

          if (backendConnected) {
            const formData = new FormData();
            formData.append('latitude', report.latitude.toString());
            formData.append('longitude', report.longitude.toString());
            if (currentUser?.id) {
              formData.append('reporter_id', currentUser.id);
            }
            fetch(`${SPATIAL_SERVICE_BASE_URL}/reports/create`, {
              method: 'POST',
              body: formData
            }).then(async (res) => {
              if (res.ok) {
                const data = await res.json();
                console.log('Report created successfully in backend:', data);
                if (currentUser?.id) {
                  fetch(`${BACKEND_BASE_URL}/gamification/event`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ event: 'REPORT_CREATED', userId: currentUser.id })
                  }).catch(console.error);
                }
              }
            }).catch(err => {
              console.error('Failed to upload report to backend:', err);
            });
          }

          setTimeout(() => {
            setVerificationState({ isOpen: false, status: 'idle' });
            setPendingReportData(null);
            if (onComplete) onComplete(true);
          }, 1500);

        }, 1000);
      }, 1000);
    }, 1200);
  };

  // --- Refs ---
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const markersRef = useRef<{ [key: string]: maplibregl.Marker }>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Initialize Chatbot Welcome Message when Language Changes ---
  useEffect(() => {
    if (chatbotLanguage === 'EN') {
      setChatMessages([
        { sender: 'bot', text: 'Hello! I am your Civic Assistant. What hyperlocal problem would you like to report? Please describe it in detail.' }
      ]);
    } else {
      setChatMessages([
        { sender: 'bot', text: 'नमस्ते! मैं आपका नागरिक सहायक हूँ। आप किस समस्या की रिपोर्ट करना चाहते हैं? कृपया विस्तार से बताएं।' }
      ]);
    }
    setChatStep(0);
    setChatDraftReport({});
  }, [chatbotLanguage]);

  // --- Auth: Load from localStorage ---
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('communityHero_currentUser');
      if (savedUser) {
        setCurrentUser(JSON.parse(savedUser));
      }
      const savedUsers = localStorage.getItem('communityHero_users');
      if (savedUsers) {
        setMockUsers(JSON.parse(savedUsers));
      }
    } catch {
      // ignore
    }
  }, []);

  // --- Check Backend & Load Reports ---
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const [nestjsRes, fastapiRes] = await Promise.all([
          fetch(`${BACKEND_BASE_URL}`).then(r => r.ok).catch(() => false),
          fetch(`${SPATIAL_SERVICE_BASE_URL}/health`).then(r => r.json()).catch(() => null)
        ]);
        if (nestjsRes && fastapiRes && fastapiRes.status === 'ok') {
          setBackendConnected(true);
        } else {
          setBackendConnected(false);
        }
      } catch {
        setBackendConnected(false);
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!backendConnected) {
      setReports(MOCK_REPORTS);
      return;
    }
    const loadReportsFromBackend = async () => {
      try {
        const res = await fetch(`${SPATIAL_SERVICE_BASE_URL}/reports/nearby?lat=28.6139&lon=77.2090&radius=10000000`);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.reports)) {
            const mapped = data.reports.map((r: any) => ({
              id: r.id,
              category: r.category || 'Other',
              severity: r.severity || 'Medium',
              status: r.status || 'Reported',
              latitude: r.latitude,
              longitude: r.longitude,
              original_media_url: r.original_media_url || 'https://images.unsplash.com/photo-1599740831464-5eecfa64b8a5?auto=format&fit=crop&w=800&q=80',
              s3_media_url: r.s3_media_url || r.original_media_url || 'https://images.unsplash.com/photo-1599740831464-5eecfa64b8a5?auto=format&fit=crop&w=800&q=80',
              upvotes: r.upvotes || 0,
              downvotes: r.downvotes || 0,
              created_at: r.created_at || new Date().toISOString(),
              description: r.description || 'Civic issue reported via Community Hero.',
              colony_area: r.colony_area || 'Delhi, India',
              reporter_name: r.reporter_name || 'Citizen',
              comments: r.comments || []
            }));
            if (mapped.length > 0) {
              setReports(mapped);
            } else {
              setReports(MOCK_REPORTS);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load reports from backend:', err);
      }
    };
    loadReportsFromBackend();
  }, [backendConnected]);

  // --- Auth Handlers ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (backendConnected) {
      try {
        const res = await fetch(`${BACKEND_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: authEmail })
        });
        if (res.ok) {
          const data = await res.json();
          localStorage.setItem('communityHero_token', data.accessToken);
          const loggedUser: AppUser = {
            id: data.user.id,
            name: data.user.anonymizedDisplayName,
            email: authEmail,
            role: authRole
          };
          setCurrentUser(loggedUser);
          localStorage.setItem('communityHero_currentUser', JSON.stringify(loggedUser));
          setAuthEmail('');
          setAuthPassword('');
          return;
        } else {
          const errData = await res.json().catch(() => ({}));
          setAuthError(errData.message || 'Login failed.');
          return;
        }
      } catch (err) {
        console.error('Backend login failed, falling back to mock mode:', err);
      }
    }

    const user = mockUsers.find(u => u.email === authEmail && u.password === authPassword);
    if (!user) {
      setAuthError('Invalid email or password.');
      return;
    }
    setCurrentUser(user);
    localStorage.setItem('communityHero_currentUser', JSON.stringify(user));
    setAuthEmail('');
    setAuthPassword('');
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    // Government accounts: enforce official domain
    if (authRole === 'government') {
      const govDomains = ['.gov.in', '.nic.in', '.gov', '.nic'];
      const hasGovDomain = govDomains.some(d => authEmail.toLowerCase().endsWith(d));
      if (!hasGovDomain) {
        setAuthError('Government accounts require an official email (e.g. @org.gov.in or @dept.nic.in).');
        return;
      }
      // Trigger MFA step
      const newUser: AppUser = { id: `user-${Date.now()}`, name: authName, email: authEmail, password: authPassword, role: authRole };
      setMfaPendingUser(newUser);
      setMfaStep(true);
      return;
    }

    if (backendConnected) {
      try {
        const res = await fetch(`${BACKEND_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: authEmail })
        });
        if (res.ok) {
          const data = await res.json();
          if (authName) {
            await fetch(`${BACKEND_BASE_URL}/users/me/display-name`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${data.accessToken}`
              },
              body: JSON.stringify({ name: authName })
            }).catch(console.error);
          }

          localStorage.setItem('communityHero_token', data.accessToken);
          const loggedUser: AppUser = {
            id: data.user.id,
            name: authName || data.user.anonymizedDisplayName,
            email: authEmail,
            role: authRole
          };
          setCurrentUser(loggedUser);
          localStorage.setItem('communityHero_currentUser', JSON.stringify(loggedUser));
          setAuthName('');
          setAuthEmail('');
          setAuthPassword('');
          return;
        } else {
          const errData = await res.json().catch(() => ({}));
          setAuthError(errData.message || 'Signup failed.');
          return;
        }
      } catch (err) {
        console.error('Backend signup failed, falling back to mock mode:', err);
      }
    }

    if (mockUsers.find(u => u.email === authEmail)) {
      setAuthError('An account with this email already exists.');
      return;
    }
    const newUser: AppUser = {
      id: `user-${Date.now()}`,
      name: authName,
      email: authEmail,
      password: authPassword,
      role: authRole
    };
    const updatedUsers = [...mockUsers, newUser];
    setMockUsers(updatedUsers);
    setCurrentUser(newUser);
    localStorage.setItem('communityHero_users', JSON.stringify(updatedUsers));
    localStorage.setItem('communityHero_currentUser', JSON.stringify(newUser));
    setAuthName('');
    setAuthEmail('');
    setAuthPassword('');
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(mfaCode)) {
      setAuthError('Please enter a valid 6-digit verification code.');
      return;
    }
    if (!mfaPendingUser) return;

    if (backendConnected) {
      try {
        const res = await fetch(`${BACKEND_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: mfaPendingUser.email })
        });
        if (res.ok) {
          const data = await res.json();
          if (mfaPendingUser.name) {
            await fetch(`${BACKEND_BASE_URL}/users/me/display-name`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${data.accessToken}`
              },
              body: JSON.stringify({ name: mfaPendingUser.name })
            }).catch(console.error);
          }

          localStorage.setItem('communityHero_token', data.accessToken);
          const loggedUser: AppUser = {
            id: data.user.id,
            name: mfaPendingUser.name || data.user.anonymizedDisplayName,
            email: mfaPendingUser.email,
            role: mfaPendingUser.role
          };
          setCurrentUser(loggedUser);
          localStorage.setItem('communityHero_currentUser', JSON.stringify(loggedUser));
          setMfaStep(false);
          setMfaCode('');
          setMfaPendingUser(null);
          setAuthName('');
          setAuthEmail('');
          setAuthPassword('');
          return;
        }
      } catch (err) {
        console.error('Backend MFA verification failed, falling back to mock mode:', err);
      }
    }

    const updatedUsers = [...mockUsers, mfaPendingUser];
    setMockUsers(updatedUsers);
    setCurrentUser(mfaPendingUser);
    localStorage.setItem('communityHero_users', JSON.stringify(updatedUsers));
    localStorage.setItem('communityHero_currentUser', JSON.stringify(mfaPendingUser));
    setMfaStep(false);
    setMfaCode('');
    setMfaPendingUser(null);
    setAuthName('');
    setAuthEmail('');
    setAuthPassword('');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('communityHero_currentUser');
    setSelectedReport(null);
    setIsChatOpen(false);
  };

  // --- WebSocket Setup ---
  useEffect(() => {
    if (!currentUser) return;

    socketRef.current = io('http://localhost:3000', {
      auth: { userId: 'web-dashboard-admin' },
      transports: ['websocket'],
      autoConnect: true
    });

    socketRef.current.on('map_update', (newReport: any) => {
      setReports((prev) => [newReport, ...prev]);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [currentUser]);

  // --- Map Markers Rendering (with Stop Propagation to fix coordinates fluctuation) ---
  const updateMapMarkers = () => {
    if (!map.current) return;
    Object.values(markersRef.current).forEach((m: any) => m.remove());
    markersRef.current = {};

    reports.forEach((report) => {
      // The parent element is registered with MapLibre GL and does not scale/change size.
      const el = document.createElement('div');
      el.style.width = '32px';
      el.style.height = '32px';
      el.style.cursor = 'pointer';

      // The child element contains the actual marker visual style and transition.
      const pin = document.createElement('div');
      pin.className = 'w-full h-full rounded-full border border-black flex items-center justify-center shadow-md transition-transform hover:scale-110 duration-150';
      pin.style.backgroundColor = getSeverityColor(report.severity);
      pin.style.transformOrigin = 'bottom center';
      pin.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
        </svg>
      `;

      el.appendChild(pin);

      // FIX: Stop propagation to prevent map click event bubbling which resets/fluctuates coordinates!
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedReport(report);
      });

      // Pass anchor: 'bottom' to align pinpoint coordinates exactly
      const m = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([report.longitude, report.latitude])
        .addTo(map.current!);

      markersRef.current[report.id] = m;
    });
  };

  // --- Map Initialization (Centers on India, handles proper resizing) ---
  const initMap = () => {
    if (!mapContainer.current) return;
    if (map.current) {
      map.current.remove();
    }

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: [78.9629, 20.5937],
      zoom: 5,
      maxZoom: 18,
      maxBounds: [[65.0, 5.0], [100.0, 40.0]]
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.current.on('click', (e: any) => {
      const lat = e.lngLat.lat;
      const lon = e.lngLat.lng;
      if (lat >= 5.0 && lat <= 40.0 && lon >= 65.0 && lon <= 100.0) {
        setFormLatitude(lat.toFixed(5));
        setFormLongitude(lon.toFixed(5));
      } else {
        alert('Please select a location within India.');
      }
    });

    map.current.on('load', () => {
      updateMapMarkers();
      map.current?.resize();
    });
  };

  // Re-run map initialization when tab switches back to 'map'
  useEffect(() => {
    if (currentUser && activeTab === 'map') {
      // Give the DOM time to fully render before initializing the map
      setTimeout(() => {
        initMap();
      }, 150);
      // Extra resize call after tiles have had time to load
      setTimeout(() => {
        map.current?.resize();
      }, 500);
    }
  }, [currentUser, activeTab]);

  // Trigger resize if details card is toggled
  useEffect(() => {
    if (activeTab === 'map' && map.current) {
      setTimeout(() => {
        map.current?.resize();
      }, 100);
    }
  }, [selectedReport]);

  useEffect(() => {
    updateMapMarkers();
  }, [reports]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // --- Helpers ---
  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'severe': return '#000000';
      case 'medium': return '#4b5563';
      default: return '#9ca3af';
    }
  };

  const getStatusBadge = (status: string) => {
    const base = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ';
    let cls = base;
    switch (status.toLowerCase()) {
      case 'resolved': cls += 'bg-emerald-100 text-emerald-800 border border-emerald-200'; break;
      case 'verified': cls += 'bg-zinc-900 text-white border border-black'; break;
      default: cls += 'bg-zinc-100 text-zinc-600 border border-zinc-200'; break;
    }
    return <span className={cls}>{status}</span>;
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'government': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'company': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-zinc-100 text-zinc-600 border-zinc-200';
    }
  };

  // --- Filtering ---
  const filteredReports = reports.filter((r) => {
    const matchesCategory = filterCategory === 'All' || r.category === filterCategory;
    const matchesStatus = filterStatus === 'All' || r.status === filterStatus;
    const matchesSearch = searchQuery === '' ||
      r.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.colony_area?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesStatus && matchesSearch;
  });

  // --- Form Handlers ---
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const isWithinIndia = (lat: number, lon: number) => {
    return lat >= 5.0 && lat <= 40.0 && lon >= 65.0 && lon <= 100.0;
  };

  const handleShareLiveLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (!isWithinIndia(latitude, longitude)) {
          alert('We only support civic issues within India. Please share a valid location in India.');
          return;
        }
        setFormLatitude(latitude.toString());
        setFormLongitude(longitude.toString());
        
        if (map.current) {
          map.current.flyTo({ center: [longitude, latitude], zoom: 15 });
        }
      },
      (error) => {
        alert('Unable to retrieve your location. Please check your location services and try again.');
        console.error('Geolocation error:', error);
      }
    );
  };

  const handleCreateReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      alert('Please login first to submit a report.');
      return;
    }
    const lat = parseFloat(formLatitude);
    const lon = parseFloat(formLongitude);
    if (isNaN(lat) || isNaN(lon)) {
      alert('Please share your live location or click on the map to confirm coordinates.');
      return;
    }
    if (!isWithinIndia(lat, lon)) {
      alert('We only support civic issues within India. Please select a location in India.');
      return;
    }
    const defaultPhoto = 'https://images.unsplash.com/photo-1599740831464-5eecfa64b8a5?auto=format&fit=crop&w=800&q=80';
    const originalPhoto = formPhoto || defaultPhoto;
    const newReport: IssueReport = {
      id: `report-${Date.now()}`,
      category: formCategory,
      severity: formSeverity,
      status: 'Reported',
      latitude: lat,
      longitude: lon,
      original_media_url: originalPhoto,
      s3_media_url: originalPhoto,
      upvotes: 1,
      downvotes: 0,
      created_at: new Date().toISOString(),
      description: formDescription,
      colony_area: formColonyArea || 'Unknown Area',
      reporter_name: currentUser?.name || 'citizen',
      comments: []
    };
    
    startReportVerification(newReport);
    
    setFormDescription('');
    setFormColonyArea('');
    setFormPhoto(null);
    setShowReportForm(false);
  };

  const handleVote = (id: string, type: 'up' | 'down') => {
    if (votedReports.has(id)) return;
    setVotedReports(prev => new Set(prev).add(id));
    setReports((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return {
            ...r,
            upvotes: type === 'up' ? r.upvotes + 1 : r.upvotes,
            downvotes: type === 'down' ? r.downvotes + 1 : r.downvotes
          };
        }
        return r;
      })
    );
    if (selectedReport && selectedReport.id === id) {
      setSelectedReport((prev) => prev ? {
        ...prev,
        upvotes: type === 'up' ? prev.upvotes + 1 : prev.upvotes,
        downvotes: type === 'down' ? prev.downvotes + 1 : prev.downvotes
      } : null);
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || !selectedReport || !currentUser) return;
    const newComment: Comment = {
      author: currentUser.name,
      text: commentInput,
      created_at: new Date().toISOString()
    };
    setReports((prev) =>
      prev.map((r) => {
        if (r.id === selectedReport.id) {
          return { ...r, comments: [...r.comments, newComment] };
        }
        return r;
      })
    );
    setSelectedReport((prev) => prev ? {
      ...prev,
      comments: [...prev.comments, newComment]
    } : null);
    setCommentInput('');
  };

  // --- Map Search (Nominatim) ---
  const handleMapSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapSearchQuery.trim()) return;
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mapSearchQuery)}&countrycodes=in&limit=5`
      );
      const results: MapSearchResult[] = await response.json();
      if (results.length > 0) {
        setMapSearchResults(results);
      } else {
        setMapSearchResults([]);
      }
    } catch {
      console.error('Map search failed');
    }
  };

  const handleSearchResultClick = (result: MapSearchResult) => {
    if (map.current) {
      map.current.flyTo({
        center: [parseFloat(result.lon), parseFloat(result.lat)],
        zoom: 14
      });
    }
    setMapSearchResults([]);
    setMapSearchQuery('');
  };

  // --- Resolution Handler ---
  const handleResolvePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setResolvePhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResolveReport = () => {
    if (!currentUser || !selectedReport || !resolvePhoto) return;
    if (currentUser.role !== 'government' && currentUser.role !== 'company') {
      alert('Only authorized Government officials or assigned Companies can mark issues as resolved.');
      return;
    }
    const resolutionComment: Comment = {
      author: currentUser.name,
      text: '✅ Issue has been resolved. Completion photo uploaded as proof.',
      created_at: new Date().toISOString()
    };
    setReports(prev =>
      prev.map(r =>
        r.id === selectedReport.id
          ? { ...r, status: 'Resolved', comments: [...r.comments, resolutionComment] }
          : r
      )
    );
    setSelectedReport(prev => prev ? {
      ...prev,
      status: 'Resolved',
      comments: [...prev.comments, resolutionComment]
    } : null);
    setResolvePhoto(null);
  };

  // --- Geolocation attachment for chatbot ---
  const handleAttachLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const locText = `📍 My current location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        handleSendChatMessage(locText);
      },
      () => alert('Unable to retrieve your location. Please allow location access.')
    );
  };  // --- Rotating Gemini Key helper ---
  const fetchGeminiRotate = async (apiMessages: any[], systemInstruction: string) => {
    const keys = GEMINI_API_KEYS.filter(
      (k: string) => k && k !== "YOUR_GEMINI_KEY_1" && k !== "YOUR_GEMINI_KEY_2" && k !== "YOUR_GEMINI_KEY_3" && k !== "YOUR_GEMINI_KEY_4" && k !== "YOUR_GEMINI_KEY_5"
    );

    if (keys.length === 0) {
      throw new Error("No configured Gemini API keys found.");
    }

    for (let i = 0; i < keys.length; i++) {
      const activeKey = keys[i];
      try {
        const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`;
        const response = await fetch(apiURL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: apiMessages,
            systemInstruction: {
              parts: [{ text: systemInstruction }]
            },
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        });

        if (response.ok) {
          const resData = await response.json();
          const text = resData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return text;
        } else {
          console.warn(`Gemini key index ${i} failed with status: ${response.status}. Rotating key...`);
        }
      } catch (err) {
        console.error(`Gemini key index ${i} threw error:`, err);
      }
    }
    throw new Error("All configured Gemini API keys failed or returned errors.");
  };

  // --- Chatbot Handler (With Hindi & Nominatim Colony/City parser) ---
  const handleSendChatMessage = async (textToSend?: string) => {
    const text = textToSend || chatInput;
    if (!text.trim()) return;

    const isHi = chatbotLanguage === 'HI';

    // Guest protection inside Chatbot
    if (isGuest) {
      const lowerText = text.toLowerCase().trim();
      const greetings = ['hello', 'hi', 'hey', 'hlo', 'hola', 'namaste', 'नमस्ते', 'नमस्कार'];
      const isGreeting = greetings.some(g => lowerText === g || lowerText.startsWith(g));
      if (!isGreeting) {
        alert(isHi ? 'कृपया रिपोर्ट करने के लिए पहले लॉग इन करें।' : 'Please login first to report an issue.');
        setChatInput('');
        return;
      }
    }

    setChatMessages(prev => [...prev, { sender: 'user' as const, text }]);
    setChatInput('');

    // Wait a brief moment to simulate processing
    setTimeout(async () => {
      const coordsRegex = /(-?\d+\.\d+),\s*(-?\d+\.\d+)/;

      // 1. Check if user is sharing/attaching location coordinates when not expected
      if (text.includes('📍') || text.match(coordsRegex)) {
        if (chatStep !== 3) {
          const match = text.match(coordsRegex);
          if (match) {
            const latVal = parseFloat(match[1]);
            const lonVal = parseFloat(match[2]);
            
            if (!isWithinIndia(latVal, lonVal)) {
              const outOfIndiaMsg = isHi
                ? `📍 स्थान भारत से बाहर है (${latVal.toFixed(4)}, ${lonVal.toFixed(4)})। हम केवल भारत के भीतर की समस्याओं का समर्थन करते हैं।`
                : `📍 Captured location is outside India (${latVal.toFixed(4)}, ${lonVal.toFixed(4)}). We only support issues within India.`;
              setChatMessages(prev => [...prev, { sender: 'bot', text: outOfIndiaMsg }]);
              return;
            }

            setChatDraftReport(prev => ({ ...prev, latitude: latVal, longitude: lonVal }));
            const responseText = isHi
              ? `📍 स्थान दर्ज कर लिया गया है (${latVal.toFixed(4)}, ${lonVal.toFixed(4)})। कृपया पहले समस्या का विवरण दें:`
              : `📍 Location captured (${latVal.toFixed(4)}, ${lonVal.toFixed(4)}). Please describe the issue you want to report first:`;
            setChatMessages(prev => [...prev, { sender: 'bot', text: responseText }]);
            return;
          }
        }
      }

      // Check if we have active Gemini API keys
      const activeKeys = GEMINI_API_KEYS.filter(
        (k: string) => k && k !== "YOUR_GEMINI_KEY_1" && k !== "YOUR_GEMINI_KEY_2" && k !== "YOUR_GEMINI_KEY_3" && k !== "YOUR_GEMINI_KEY_4" && k !== "YOUR_GEMINI_KEY_5"
      );

      // 2. Call Gemini API if configured
      if (activeKeys.length > 0) {
        try {
          const systemInstruction = `
You are the Civic Assistant for the 'Community Hero' hyperlocal problem solver platform in India.
Your job is to act as an intelligent AI assistant.
You must ONLY discuss topics related to the Community Hero platform, civic issues, reporting problems (potholes, waste, water leak, infrastructure, etc.), urban improvements, and general engagement on this platform.
Reject off-topic questions (e.g. general knowledge, math, general programming, other websites, general advice) politely. Example: "I am a Civic Assistant for Community Hero. I can only assist you with reporting or discussing local civic issues."

Your goal is to converse with the user and collect the following fields to report a civic issue:
1. category: MUST be one of: "Pothole", "Waste", "Water Leak", "Broken Infrastructure", "Graffiti", "Other".
2. description: Details of the issue.
3. severity: MUST be one of: "Minor", "Medium", "Severe". Default to "Medium" if unspecified.
4. colony_area: Colony name or coordinates representation.

Currently collected details from prior turns (use these to avoid asking duplicates):
- Category: ${chatDraftReport.category || 'Not specified'}
- Description: ${chatDraftReport.description || 'Not specified'}
- Severity: ${chatDraftReport.severity || 'Not specified'}
- Colony/Location: ${chatDraftReport.colony_area || (chatDraftReport.latitude ? chatDraftReport.latitude + ', ' + chatDraftReport.longitude : 'Not specified')}

Instructions:
1. Talk naturally. Be conversational. Respond to greetings and platform questions.
2. If they are reporting an issue, look at what is missing and ask for it.
3. If they shared location coords (e.g., '27.21793, 77.47152' or 'My location: 28.5, 77.2'), parse them.
4. You MUST format your entire response as a single valid JSON object containing exactly these keys:
{
  "reply": "Your conversational message to the user",
  "extractedInfo": {
    "category": "Pothole" | "Waste" | "Water Leak" | "Broken Infrastructure" | "Graffiti" | "Other" | null,
    "description": "description text" | null,
    "severity": "Minor" | "Medium" | "Severe" | null,
    "colony_area": "colony name" | null,
    "latitude": number | null,
    "longitude": number | null
  },
  "readyToSubmit": boolean
}
Do NOT wrap the response in markdown blocks. Return only raw JSON.
`;

          // Get last 8 messages for context
          const apiMessages = chatMessages.slice(-8).map(m => ({
            role: m.sender === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }]
          }));
          apiMessages.push({
            role: 'user',
            parts: [{ text: text }]
          });

          const responseText = await fetchGeminiRotate(apiMessages, systemInstruction);
          
          if (responseText) {
            const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
            const payload = JSON.parse(cleanJson);
            
            if (payload.extractedInfo) {
              setChatDraftReport(prev => {
                const updated = { ...prev };
                if (payload.extractedInfo.category) updated.category = payload.extractedInfo.category;
                if (payload.extractedInfo.description) updated.description = payload.extractedInfo.description;
                if (payload.extractedInfo.severity) updated.severity = payload.extractedInfo.severity;
                if (payload.extractedInfo.colony_area) updated.colony_area = payload.extractedInfo.colony_area;
                if (payload.extractedInfo.latitude) updated.latitude = payload.extractedInfo.latitude;
                if (payload.extractedInfo.longitude) updated.longitude = payload.extractedInfo.longitude;
                return updated;
              });
            }

            if (payload.readyToSubmit) {
              const finalDraft = {
                ...chatDraftReport,
                ...payload.extractedInfo
              };

              let lat = finalDraft.latitude || 28.6139;
              let lon = finalDraft.longitude || 77.2090;
              let colArea = finalDraft.colony_area || 'Indiranagar, Bangalore';

              if (isWithinIndia(lat, lon)) {
                const newReport: IssueReport = {
                  id: `report-${Date.now()}`,
                  category: finalDraft.category || 'Other',
                  severity: finalDraft.severity || 'Medium',
                  status: 'Reported',
                  latitude: lat,
                  longitude: lon,
                  original_media_url: 'https://images.unsplash.com/photo-1599740831464-5eecfa64b8a5?auto=format&fit=crop&w=800&q=80',
                  s3_media_url: 'https://images.unsplash.com/photo-1599740831464-5eecfa64b8a5?auto=format&fit=crop&w=800&q=80',
                  upvotes: 1,
                  downvotes: 0,
                  created_at: new Date().toISOString(),
                  description: finalDraft.description || '',
                  colony_area: colArea,
                  reporter_name: currentUser?.name || 'citizen',
                  comments: []
                };

                const successText = isHi
                  ? `धन्यवाद! मैंने आपकी रिपोर्ट दर्ज कर ली है और इसे मैप पर पिन कर दिया है। (${lat.toFixed(4)}, ${lon.toFixed(4)})`
                  : `Thank you! I have filed your report and pinned it on the map at (${lat.toFixed(4)}, ${lon.toFixed(4)}).`;

                startReportVerification(newReport, (success) => {
                  if (success) {
                    setChatStep(0);
                    setChatDraftReport({});
                    setChatMessages([{ sender: 'bot', text: successText }]);
                  } else {
                    setChatMessages(prev => [...prev, { sender: 'bot', text: isHi ? 'सत्यापन विफल। कृपया वैध विवरण प्रदान करें।' : 'Verification failed. Please provide valid details.' }]);
                  }
                });
                return;
              }
            }

            setChatMessages(prev => [...prev, { sender: 'bot', text: payload.reply }]);
            return;
          }
        } catch (apiErr) {
          console.error("Gemini API call failed, falling back to local simulation", apiErr);
        }
      }

      // 3. Fallback Local AI Simulation
      const lowerText = text.toLowerCase().trim();
      const isOffTopic = (t: string) => {
        const offTopicKeywords = [
          'joke', 'code', 'python', 'javascript', 'html', 'css', 'math', 'calculator', 'science',
          'weather', 'news', 'recipe', 'game', 'play', 'movie', 'song', 'spotify', 'facebook',
          'google', 'amazon', 'write a', 'how to write', 'sort an array', 'binary search', 'class'
        ];
        if (t.match(/\b(2\+2|5\+5|10\+10)\b/) || t.includes('+') || t.includes('-') || t.includes('*') || t.includes('/')) {
          if (!t.includes('location') && !t.includes('coord')) return true;
        }
        return offTopicKeywords.some(keyword => t.includes(keyword));
      };

      if (isOffTopic(lowerText)) {
        const offTopicText = isHi
          ? `मैं केवल कम्युनिटी हीरो वेबसाइट और नागरिक समस्याओं (जैसे कचरा, गड्ढे, लीक) से संबंधित प्रश्नों का उत्तर दे सकता हूँ। कृपया केवल वही साझा करें!`
          : `I am a Civic Assistant for the Community Hero platform. I can only assist with reporting or resolving civic issues (like waste, potholes, water leaks). Let's stay focused on helping the community!`;
        setChatMessages(prev => [...prev, { sender: 'bot', text: offTopicText }]);
        return;
      }

      // Greetings
      const greetings = ['hello', 'hi', 'hey', 'hlo', 'hola', 'namaste', 'नमस्ते', 'नमस्कार'];
      if (greetings.some(g => lowerText === g || lowerText.startsWith(g))) {
        const reply = isHi
          ? `नमस्ते! मैं आपका नागरिक सहायक हूँ। आप किस नागरिक समस्या (सड़क के गड्ढे, कचरा, पानी का रिसाव आदि) की रिपोर्ट करना चाहते हैं?`
          : `Hello! I am your AI Civic Assistant. What local civic issue would you like to report today?`;
        setChatMessages(prev => [...prev, { sender: 'bot', text: reply }]);
        return;
      }

      let currentDraft = { ...chatDraftReport };
      if (!currentDraft.description) {
        let guessedCategory = 'Other';
        if (lowerText.includes('pothole') || lowerText.includes('road') || lowerText.includes('gaddha') || lowerText.includes('pavement')) {
          guessedCategory = 'Pothole';
        } else if (lowerText.includes('garbage') || lowerText.includes('kuda') || lowerText.includes('trash') || lowerText.includes('waste')) {
          guessedCategory = 'Waste';
        } else if (lowerText.includes('leak') || lowerText.includes('water') || lowerText.includes('pani') || lowerText.includes('pipe')) {
          guessedCategory = 'Water Leak';
        } else if (lowerText.includes('broken') || lowerText.includes('light') || lowerText.includes('infrastructure')) {
          guessedCategory = 'Broken Infrastructure';
        } else if (lowerText.includes('graffiti') || lowerText.includes('paint') || lowerText.includes('wall')) {
          guessedCategory = 'Graffiti';
        }
        
        currentDraft.description = text;
        currentDraft.category = guessedCategory;
        setChatDraftReport(currentDraft);
        setChatStep(1);

        const responseText = isHi
          ? `विवरण: "${text}"। मैंने श्रेणी "${guessedCategory}" का अनुमान लगाया है। क्या यह सही है या नीचे से चुनें:`
          : `Description: "${text}". I guessed the category is "${guessedCategory}". Is that correct, or select from below:`;
        
        setChatMessages(prev => [...prev, {
          sender: 'bot',
          text: responseText,
          options: ['Pothole', 'Waste', 'Water Leak', 'Broken Infrastructure', 'Graffiti', 'Other']
        }]);
        return;
      }

      if (chatStep === 1) {
        const validCategories = ['pothole', 'waste', 'water leak', 'broken infrastructure', 'graffiti', 'other'];
        const matched = validCategories.find(c => lowerText.includes(c));
        if (matched) {
          const categoryLabel = matched.charAt(0).toUpperCase() + matched.slice(1);
          currentDraft.category = categoryLabel;
          setChatDraftReport(currentDraft);
          setChatStep(2);
          
          const responseText = isHi
            ? `श्रेणी: ${categoryLabel}। गंभीरता क्या है?`
            : `Category: ${categoryLabel}. What is the severity level?`;
          
          setChatMessages(prev => [...prev, {
            sender: 'bot',
            text: responseText,
            options: isHi ? ['सामान्य (Minor)', 'मध्यम (Medium)', 'गंभीर (Severe)'] : ['Minor', 'Medium', 'Severe']
          }]);
        } else {
          const responseText = isHi
            ? `कृपया नीचे से एक वैध श्रेणी चुनें:`
            : `Please select a valid category from below:`;
          setChatMessages(prev => [...prev, {
            sender: 'bot',
            text: responseText,
            options: ['Pothole', 'Waste', 'Water Leak', 'Broken Infrastructure', 'Graffiti', 'Other']
          }]);
        }
        return;
      }

      if (chatStep === 2) {
        const severityMapping: Record<string, string> = {
          'minor': 'Minor',
          'medium': 'Medium',
          'severe': 'Severe',
          'सामान्य': 'Minor',
          'मध्यम': 'Medium',
          'गंभीर': 'Severe'
        };
        let mapped = null;
        for (const [k, v] of Object.entries(severityMapping)) {
          if (lowerText.includes(k)) {
            mapped = v;
            break;
          }
        }
        if (mapped) {
          currentDraft.severity = mapped;
          setChatDraftReport(currentDraft);
          setChatStep(3);

          const responseText = isHi
            ? `स्थान दर्ज करें। कृपया शहर और कॉलोनी का नाम बताएं (जैसे: Bharatpur, Subhash Nagar) या '📍 लाइव स्थान साझा करें' बटन दबाएं:`
            : `Please enter the location. Provide the City and Colony/Area name (e.g., Bharatpur, Subhash Nagar) or click '📍 Attach Live Location':`;
          setChatMessages(prev => [...prev, { sender: 'bot', text: responseText }]);
        } else {
          const responseText = isHi
            ? `कृपया एक वैध गंभीरता स्तर (Minor, Medium, Severe) चुनें:`
            : `Please select a valid severity level (Minor, Medium, or Severe):`;
          setChatMessages(prev => [...prev, {
            sender: 'bot',
            text: responseText,
            options: isHi ? ['सामान्य (Minor)', 'मध्यम (Medium)', 'गंभीर (Severe)'] : ['Minor', 'Medium', 'Severe']
          }]);
        }
        return;
      }

      if (chatStep === 3) {
        let lat = 28.6139;
        let lon = 77.2090;
        let locationQuery = text;
        let isCoords = false;

        const match = text.match(coordsRegex);
        if (match) {
          lat = parseFloat(match[1]);
          lon = parseFloat(match[2]);
          locationQuery = `Coordinates (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
          isCoords = true;
        }

        if (!isCoords && currentDraft.latitude && currentDraft.longitude) {
          lat = currentDraft.latitude;
          lon = currentDraft.longitude;
          locationQuery = `Coordinates (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
          isCoords = true;
        }

        if (!isCoords) {
          const loadingMsg = isHi
            ? `स्थान "${locationQuery}" को खोजा जा रहा है...`
            : `Resolving location coordinates for "${locationQuery}"...`;
          setChatMessages(prev => [...prev, { sender: 'bot', text: loadingMsg }]);
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationQuery)}&countrycodes=in&limit=1`);
            const results = await res.json();
            if (results && results.length > 0) {
              lat = parseFloat(results[0].lat);
              lon = parseFloat(results[0].lon);
            }
          } catch (e) {
            console.error(e);
          }
        }

        if (!isWithinIndia(lat, lon)) {
          const failText = isHi
            ? `हम केवल भारत के भीतर की समस्याओं का समर्थन करते हैं। कृपया भारत में एक वैध स्थान प्रदान करें:`
            : `Sorry, we only support civic issues within India. Please provide a valid location in India:`;
          setChatMessages(prev => [...prev, { sender: 'bot', text: failText }]);
          return;
        }

        const newReport: IssueReport = {
          id: `report-${Date.now()}`,
          category: currentDraft.category || 'Other',
          severity: currentDraft.severity || 'Medium',
          status: 'Reported',
          latitude: lat,
          longitude: lon,
          original_media_url: 'https://images.unsplash.com/photo-1599740831464-5eecfa64b8a5?auto=format&fit=crop&w=800&q=80',
          s3_media_url: 'https://images.unsplash.com/photo-1599740831464-5eecfa64b8a5?auto=format&fit=crop&w=800&q=80',
          upvotes: 1,
          downvotes: 0,
          created_at: new Date().toISOString(),
          description: currentDraft.description || '',
          colony_area: locationQuery.replace(/📍/g, '').trim(),
          reporter_name: currentUser?.name || 'citizen',
          comments: []
        };

        const successText = isHi
          ? `रिपोर्ट सफलतापूर्वक दर्ज की गई!`
          : `Report filed successfully!`;

        startReportVerification(newReport, (success) => {
          if (success) {
            setChatStep(0);
            setChatDraftReport({});
            setChatMessages([{ sender: 'bot', text: isHi ? `${successText} (पिन स्थान: ${lat.toFixed(4)}, ${lon.toFixed(4)})` : `${successText} I have pinned the issue to the map at ${lat.toFixed(4)}, ${lon.toFixed(4)}.` }]);
          } else {
            setChatMessages(prev => [...prev, { sender: 'bot', text: isHi ? 'सत्यापन विफल। कृपया वैध विवरण प्रदान करें।' : 'Verification failed. Please provide valid details.' }]);
          }
        });
      }
    }, 600);
  };
  // ==========================================
  // RENDER: Auth Screen (if not logged in)
  // ==========================================
  // --- MFA Verification Screen ---
  if (mfaStep && mfaPendingUser) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex bg-amber-500 p-3.5 rounded-2xl mb-4 shadow-lg">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">MFA Verification</h1>
            <p className="text-zinc-400 text-xs mt-2">Government account requires multi-factor authentication</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
            <p className="text-zinc-300 text-sm font-semibold mb-1">A 6-digit verification code has been sent to:</p>
            <p className="text-amber-400 text-sm font-black mb-6">{mfaPendingUser.email}</p>
            <p className="text-[10px] text-zinc-500 mb-4 font-bold">For this demo, enter any 6-digit number (e.g. 123456)</p>
            {authError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold p-3 rounded-xl mb-4">{authError}</div>
            )}
            <form onSubmit={handleMfaVerify} className="space-y-4">
              <div>
                <label className="text-[10px] text-zinc-500 uppercase font-black tracking-wider block mb-1.5">Verification Code</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="••••••"
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-2xl text-white text-center tracking-widest placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-black"
                />
              </div>
              <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-black py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer">
                Verify &amp; Complete Registration
              </button>
              <button type="button" onClick={() => { setMfaStep(false); setMfaPendingUser(null); setAuthError(''); }} className="w-full bg-zinc-800 text-zinc-400 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer hover:bg-zinc-700">
                Cancel
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-zinc-800/30 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-zinc-800/20 rounded-full blur-3xl" />
        </div>

        <div className="relative w-full max-w-lg z-10">
          <div className="text-center mb-8">
            <div className="inline-flex bg-white p-3.5 rounded-2xl mb-4 shadow-lg">
              <Shield className="h-8 w-8 text-black" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">COMMUNITY HERO</h1>
            <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mt-1.5">Civic Engagement Platform — India</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
            <div className="flex gap-1 bg-zinc-800 p-1 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError(''); }}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${authMode === 'login' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('signup'); setAuthError(''); }}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${authMode === 'signup' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'}`}
              >
                Create Account
              </button>
            </div>

            {authError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold p-3 rounded-xl mb-4">
                {authError}
              </div>
            )}

            <form onSubmit={authMode === 'login' ? handleLogin : handleSignup} className="space-y-4">
              {authMode === 'signup' && (
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase font-black tracking-wider block mb-1.5">Full Name</label>
                  <input
                    value={authName}
                    onChange={e => setAuthName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-medium"
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] text-zinc-500 uppercase font-black tracking-wider block mb-1.5">Email</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-medium"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 uppercase font-black tracking-wider block mb-1.5">Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-medium"
                />
              </div>

              {authMode === 'signup' && (
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase font-black tracking-wider block mb-2">Account Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { role: 'citizen' as UserRole, icon: <User className="h-5 w-5" />, label: 'Citizen', desc: 'Report & Vote' },
                      { role: 'company' as UserRole, icon: <Building2 className="h-5 w-5" />, label: 'Company', desc: 'Fix Issues' },
                      { role: 'government' as UserRole, icon: <Landmark className="h-5 w-5" />, label: 'Government', desc: 'Full Access' },
                    ]).map(r => (
                      <button
                        key={r.role}
                        type="button"
                        onClick={() => setAuthRole(r.role)}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          authRole === r.role
                            ? 'bg-white text-black border-white shadow-sm'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500'
                        }`}
                      >
                        <div className="flex justify-center mb-1.5">{r.icon}</div>
                        <div className="text-[10px] font-black uppercase tracking-wider">{r.label}</div>
                        <div className="text-[8px] font-bold opacity-60 mt-0.5">{r.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-white hover:bg-zinc-200 text-black py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer mt-2"
              >
                {authMode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            {authMode === 'login' && (
              <div className="mt-6 pt-4 border-t border-zinc-800">
                {import.meta.env.MODE !== 'production' && (
                  <>
                    <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-wider mb-2">Quick Test Accounts (password: test123)</p>
                    <div className="space-y-1.5 mb-3">
                      {[
                        { email: 'citizen@test.com', label: '🏠 Citizen', color: 'text-zinc-400' },
                        { email: 'company@test.com', label: '🏢 Company', color: 'text-blue-400' },
                        { email: 'gov@test.com', label: '🏛️ Government', color: 'text-amber-400' },
                      ].map(a => (
                        <button
                          key={a.email}
                          type="button"
                          onClick={() => { setAuthEmail(a.email); setAuthPassword('test123'); }}
                          className="w-full text-left bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 rounded-lg px-3 py-2 text-[10px] text-zinc-400 font-bold transition-all cursor-pointer hover:border-zinc-600"
                        >
                          <span className={a.color}>{a.label}</span>
                          <span className="text-zinc-600 ml-2">{a.email}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const guestUser: AppUser = {
                      id: `guest-${Date.now()}`,
                      name: 'citizen',
                      email: 'guest@communityhero.org',
                      password: '',
                      role: 'citizen'
                    };
                    setCurrentUser(guestUser);
                    localStorage.setItem('communityHero_currentUser', JSON.stringify(guestUser));
                  }}
                  className="w-full text-center text-zinc-500 text-xs font-bold py-2 hover:text-white transition-all cursor-pointer"
                >
                  Browse Anonymously as Guest →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: Main Dashboard
  // ==========================================
  return (
    <div className="flex flex-col h-screen bg-white text-zinc-900 overflow-hidden">
      {/* --- AI Verification Modal --- */}
      {verificationState.isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-zinc-200 text-center space-y-6 flex flex-col items-center">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 m-0">AI Quality Inspection</h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mt-1">Hyperlocal Verification System</p>
            </div>

            <div className="relative w-24 h-24 flex items-center justify-center">
              {verificationState.status === 'scanning' && (
                <>
                  <div className="absolute inset-0 border-4 border-dashed border-zinc-200 rounded-full animate-spin duration-3000" />
                  <Loader2 className="h-10 w-10 text-black animate-spin" />
                </>
              )}
              {verificationState.status === 'category' && (
                <>
                  <div className="absolute inset-0 border-4 border-zinc-300 rounded-full animate-pulse" />
                  <Bot className="h-10 w-10 text-black animate-bounce" />
                </>
              )}
              {verificationState.status === 'location' && (
                <>
                  <div className="absolute inset-0 border-4 border-zinc-300 rounded-full animate-ping" />
                  <MapPin className="h-10 w-10 text-black animate-bounce" />
                </>
              )}
              {verificationState.status === 'success' && (
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center border-2 border-emerald-400">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </div>
              )}
              {verificationState.status === 'failed' && (
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center border-2 border-red-400">
                  <AlertTriangle className="h-10 w-10 text-red-600" />
                </div>
              )}
            </div>

            <div className="space-y-1.5 px-4 min-h-[48px]">
              {verificationState.status === 'scanning' && (
                <p className="text-xs font-bold text-zinc-700 animate-pulse">Scanning submitted description & image content...</p>
              )}
              {verificationState.status === 'category' && (
                <p className="text-xs font-bold text-zinc-700 font-sans">Checking category alignment: <span className="font-extrabold text-black uppercase">{pendingReportData?.category}</span></p>
              )}
              {verificationState.status === 'location' && (
                <p className="text-xs font-bold text-zinc-700">Verifying coordinate boundaries within India region...</p>
              )}
              {verificationState.status === 'success' && (
                <p className="text-xs font-black text-emerald-700 uppercase tracking-wide">Verification Successful! Report Approved.</p>
              )}
              {verificationState.status === 'failed' && (
                <div className="space-y-1">
                  <p className="text-xs font-black text-red-700 uppercase tracking-wide">Inspection Failed</p>
                  <p className="text-[10px] text-zinc-500 font-semibold">{verificationState.errorMsg}</p>
                </div>
              )}
            </div>

            {verificationState.status !== 'success' && verificationState.status !== 'failed' && (
              <div className="relative w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
                <div 
                  className="absolute top-0 bottom-0 left-0 bg-black transition-all duration-700 rounded-full" 
                  style={{
                    width: 
                      verificationState.status === 'scanning' ? '30%' :
                      verificationState.status === 'category' ? '65%' :
                      verificationState.status === 'location' ? '90%' : '0%'
                  }} 
                />
              </div>
            )}

            {verificationState.status === 'failed' && (
              <button
                type="button"
                onClick={() => setVerificationState({ isOpen: false, status: 'idle' })}
                className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Close Inspector
              </button>
            )}
          </div>
        </div>
      )}

      {/* --- Profile Modal --- */}
      {isProfileOpen && currentUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999]">
          <div className="w-full max-w-xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-zinc-200 text-zinc-900 flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-black" />
                <h2 className="text-sm font-black uppercase tracking-wider text-black m-0">My Civic Profile</h2>
              </div>
              <button
                onClick={() => { setIsProfileOpen(false); setIsEditingProfile(false); }}
                className="p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-500 hover:text-black transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Profile Card */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 relative">
                <div className="absolute top-4 right-4">
                  {!isGuest && !isEditingProfile ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(true)}
                      className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-600 hover:text-black transition-all border border-zinc-300 rounded-lg px-2.5 py-1.5 cursor-pointer bg-white"
                    >
                      <Edit3 className="h-3 w-3" />
                      Edit
                    </button>
                  ) : isEditingProfile ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingProfile(false);
                        setProfileName(currentUser.name);
                        setProfileEmail(currentUser.email);
                      }}
                      className="text-xs text-zinc-500 font-bold hover:underline cursor-pointer"
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                      currentUser.role === 'government' ? 'bg-amber-600' : currentUser.role === 'company' ? 'bg-blue-600' : 'bg-zinc-700'
                    }`}>
                      {profileName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-black m-0">{currentUser.name}</h3>
                      <span className={`inline-block text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border mt-1 ${getRoleBadgeColor(currentUser.role)}`}>
                        {currentUser.role}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-150">
                    <div>
                      <span className="text-[9px] text-zinc-400 font-black uppercase tracking-wider">Full Name</span>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-1.5 text-xs text-zinc-900 font-bold focus:outline-none focus:border-black mt-1"
                        />
                      ) : (
                        <p className="text-xs font-bold text-zinc-800 m-0 mt-0.5">{currentUser.name}</p>
                      )}
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-400 font-black uppercase tracking-wider">Email Address</span>
                      {isEditingProfile ? (
                        <input
                          type="email"
                          value={profileEmail}
                          onChange={(e) => setProfileEmail(e.target.value)}
                          className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-1.5 text-xs text-zinc-900 font-bold focus:outline-none focus:border-black mt-1"
                        />
                      ) : (
                        <p className="text-xs font-bold text-zinc-800 m-0 mt-0.5">{currentUser.email}</p>
                      )}
                    </div>
                  </div>

                  {/* Save Button (renders only when user changes something) */}
                  {isEditingProfile && (profileName !== currentUser.name || profileEmail !== currentUser.email) && (
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          const updatedUser = { ...currentUser, name: profileName, email: profileEmail };
                          setCurrentUser(updatedUser);
                          
                          // Also update the user in mockUsers
                          const updatedUsers = mockUsers.map(u => u.id === currentUser.id ? updatedUser : u);
                          setMockUsers(updatedUsers);
                          localStorage.setItem('communityHero_users', JSON.stringify(updatedUsers));
                          localStorage.setItem('communityHero_currentUser', JSON.stringify(updatedUser));
                          
                          setIsEditingProfile(false);
                        }}
                        className="flex items-center gap-1.5 bg-black hover:bg-zinc-800 text-white text-[10px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                      >
                        <Save className="h-3.5 w-3.5" />
                        Save Changes
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* User's Reports Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-black" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-black m-0">My Filed Reports</h3>
                </div>

                <div className="space-y-2">
                  {reports.filter(r => r.reporter_name === currentUser.name).length === 0 ? (
                    <div className="text-center py-8 bg-zinc-50 border border-zinc-200 border-dashed rounded-2xl text-zinc-405 text-xs font-semibold">
                      You haven't filed any reports yet. Reports you file will appear here.
                    </div>
                  ) : (
                    reports.filter(r => r.reporter_name === currentUser.name).map(report => (
                      <div
                        key={report.id}
                        onClick={() => {
                          setSelectedReport(report);
                          setIsProfileOpen(false);
                        }}
                        className="p-3 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 hover:border-zinc-300 rounded-xl transition-all flex justify-between items-center cursor-pointer text-left"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <span className="text-[10px] font-black uppercase text-black block">{report.category}</span>
                          <span className="text-[9px] text-zinc-500 font-semibold block mt-0.5 truncate">{report.description}</span>
                          <span className="text-[8px] text-zinc-400 font-bold block mt-0.5">{report.colony_area || 'Unknown'} • {new Date(report.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {getStatusBadge(report.status)}
                          <span className="text-xs text-zinc-400">→</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Footer: Red Logout option */}
            <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex justify-center flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(false);
                  handleLogout();
                }}
                className="w-full py-3 bg-red-600 hover:bg-red-700 hover:shadow-md text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 font-bold"
              >
                <LogOut className="h-4 w-4" />
                Logout Account
              </button>
            </div>
          </div>
        </div>
      )}
      {/* --- Top Navbar --- */}
      <header className="glass sticky top-0 z-50 px-6 py-4 flex items-center justify-between border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <div className="bg-black p-2.5 rounded-xl shadow-sm">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-black m-0 leading-tight">COMMUNITY HERO</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold m-0 leading-none">Civic Engagement Platform</p>
              <span className={`inline-flex items-center gap-1 text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border leading-none ${
                backendConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                <span className={`w-1 h-1 rounded-full ${backendConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {backendConnected ? 'Connected' : 'Offline Sandbox'}
              </span>
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl border border-zinc-200">
          <button
            onClick={() => setActiveTab('map')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'map' ? 'bg-black text-white' : 'text-zinc-600 hover:text-black'
            }`}
          >
            <Compass className="h-3.5 w-3.5" />
            Live Map
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'leaderboard' ? 'bg-black text-white' : 'text-zinc-600 hover:text-black'
            }`}
          >
            <Award className="h-3.5 w-3.5" />
            Leaderboard
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'analytics' ? 'bg-black text-white' : 'text-zinc-600 hover:text-black'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Analytics
          </button>
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 px-3 py-1.5 rounded-full text-xs cursor-pointer transition-all"
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${
              currentUser.role === 'government' ? 'bg-amber-600' : currentUser.role === 'company' ? 'bg-blue-600' : 'bg-zinc-700'
            }`}>
              {currentUser.name.split(' ').map(n => n[0]).join('')}
            </div>
            <span className="text-zinc-800 font-bold max-w-[100px] truncate">{currentUser.name}</span>
            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${getRoleBadgeColor(currentUser.role)}`}>
              {currentUser.role}
            </span>
          </button>
        </div>
      </header>

      {/* --- Main Dashboard Container --- */}
      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'map' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Sidebar */}
            <aside className="w-[420px] border-r border-zinc-200 bg-zinc-50/50 flex flex-col flex-shrink-0">
              <div className="p-4 border-b border-zinc-200 flex justify-between items-center gap-3">
                <h2 className="text-sm font-black uppercase tracking-wider text-black m-0">
                  {showReportForm ? 'Report New Issue' : 'Civic Reports'}
                </h2>
                <button
                  onClick={() => {
                    if (isGuest) {
                      alert('Please login first to submit a report.');
                      return;
                    }
                    setShowReportForm(!showReportForm);
                  }}
                  className="flex items-center gap-1.5 bg-black hover:bg-zinc-800 text-white text-xs font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                >
                  {showReportForm ? (
                    <>Cancel</>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" />
                      Report Issue
                    </>
                  )}
                </button>
              </div>

              {showReportForm ? (
                <form onSubmit={handleCreateReport} className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-500 uppercase font-black tracking-wider">Category</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="bg-white border border-zinc-300 rounded-xl px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-black font-semibold"
                    >
                      <option value="Pothole">Potholes</option>
                      <option value="Waste">Waste / Garbage</option>
                      <option value="Water Leak">Water Leak</option>
                      <option value="Broken Infrastructure">Broken Infrastructure</option>
                      <option value="Graffiti">Graffiti</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-500 uppercase font-black tracking-wider">Severity</label>
                    <select
                      value={formSeverity}
                      onChange={(e) => setFormSeverity(e.target.value)}
                      className="bg-white border border-zinc-300 rounded-xl px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-black font-semibold"
                    >
                      <option value="Minor">Minor</option>
                      <option value="Medium">Medium</option>
                      <option value="Severe">Severe</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-500 uppercase font-black tracking-wider">Colony / Area Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Bharatpur, Subhash Nagar"
                      value={formColonyArea}
                      onChange={(e) => setFormColonyArea(e.target.value)}
                      required
                      className="bg-white border border-zinc-300 rounded-xl px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-black font-semibold"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-500 uppercase font-black tracking-wider">Description</label>
                    <textarea
                      placeholder="Explain the issue in detail..."
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      required
                      className="bg-white border border-zinc-300 rounded-xl px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-black h-24 resize-none font-medium"
                    />
                  </div>
                  <div className="space-y-2 bg-zinc-100 p-3 rounded-xl border border-zinc-200">
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
                      <MapPin className="h-3.5 w-3.5 text-zinc-900" />
                      <span>Report Location</span>
                    </div>
                    
                    <button
                      type="button"
                      onClick={handleShareLiveLocation}
                      className="w-full flex items-center justify-center gap-2 bg-black hover:bg-zinc-800 text-white text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer shadow-sm hover:shadow-md"
                    >
                      <MapPin className="h-4 w-4" />
                      Share Live Location
                    </button>
                    
                    {formLatitude && formLongitude ? (
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 mt-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>Location Confirmed ({parseFloat(formLatitude).toFixed(4)}, {parseFloat(formLongitude).toFixed(4)})</span>
                      </div>
                    ) : (
                      <p className="text-[10px] text-zinc-500 font-semibold mt-1">Please share your live location or click on the map to confirm coordinates.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-black tracking-wider block">Add Photo</label>
                    {formPhoto ? (
                      <div className="relative rounded-xl overflow-hidden aspect-video border border-zinc-300 bg-zinc-100">
                        <img src={formPhoto} alt="Upload preview" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setFormPhoto(null)} className="absolute top-2 right-2 bg-black/80 hover:bg-black text-white p-1 rounded-full cursor-pointer">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-zinc-300 hover:border-black rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all bg-white">
                        <Camera className="h-6 w-6 text-zinc-500" />
                        <span className="text-xs text-zinc-600 font-bold">Choose Image File</span>
                        <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                      </label>
                    )}
                  </div>
                  <button type="submit" className="w-full bg-black hover:bg-zinc-800 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer">
                    Submit Civic Report
                  </button>
                </form>
              ) : (
                <>
                  <div className="p-4 border-b border-zinc-200 flex flex-col gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                      <input
                        type="text"
                        placeholder="Search reports or areas..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-zinc-300 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-black text-zinc-900 font-semibold"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">Category</label>
                        <select
                          value={filterCategory}
                          onChange={(e) => setFilterCategory(e.target.value)}
                          className="bg-white border border-zinc-300 rounded-lg px-2 py-1.5 text-xs text-zinc-900 font-bold"
                        >
                          <option value="All">All Categories</option>
                          <option value="Pothole">Pothole</option>
                          <option value="Waste">Waste</option>
                          <option value="Water Leak">Water Leak</option>
                          <option value="Broken Infrastructure">Broken Infrastructure</option>
                          <option value="Graffiti">Graffiti</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">Status</label>
                        <select
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value)}
                          className="bg-white border border-zinc-300 rounded-lg px-2 py-1.5 text-xs text-zinc-900 font-bold"
                        >
                          <option value="All">All Statuses</option>
                          <option value="Reported">Reported</option>
                          <option value="Verified">Verified</option>
                          <option value="Resolved">Resolved</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {filteredReports.length === 0 ? (
                      <div className="text-center py-8 text-zinc-400">
                        <p className="text-xs font-semibold">No reports match your filters.</p>
                      </div>
                    ) : (
                      filteredReports.map((report) => (
                        <div
                          key={report.id}
                          onClick={() => setSelectedReport(report)}
                          className={`p-3 rounded-xl cursor-pointer border transition-all flex gap-3 ${
                            selectedReport?.id === report.id
                              ? 'bg-zinc-100 border-black'
                              : 'bg-white border-zinc-200 hover:border-zinc-300'
                          }`}
                        >
                          {/* Thumbnail */}
                          <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-zinc-100 border border-zinc-200">
                            {report.s3_media_url || report.original_media_url ? (
                              <img
                                src={report.s3_media_url || report.original_media_url || ''}
                                alt={report.category}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-300">
                                <Camera className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-1 mb-0.5">
                              <div className="flex flex-col">
                                <span className="text-xs font-black uppercase text-black">{report.category}</span>
                                <span className="text-[9px] font-bold text-zinc-500 mt-0.5">{report.colony_area || 'Unknown Area'}</span>
                              </div>
                              <span className="text-[9px] text-zinc-500 font-bold flex-shrink-0">
                                {new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-600 line-clamp-2 mb-2 font-medium">
                              {report.description || 'No description provided.'}
                            </p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getSeverityColor(report.severity) }} />
                                <span className="text-[10px] text-zinc-600 font-bold">{report.severity}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold">
                                <span className="flex items-center gap-0.5"><ThumbsUp className="h-3 w-3" /> {report.upvotes}</span>
                                <span className="flex items-center gap-0.5"><MessageSquare className="h-3 w-3" /> {report.comments.length}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </aside>

            {/* Center Area: Map container */}
            <div className="flex-1 relative bg-zinc-100 flex flex-col" style={{ minHeight: 0 }}>
              <div
                ref={mapContainer}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
              />

              {/* Map Search Overlay */}
              {!selectedReport && (
                <div className="absolute top-4 left-4 z-10 w-80">
                  <form onSubmit={handleMapSearch} className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search location in India..."
                      value={mapSearchQuery}
                      onChange={(e) => setMapSearchQuery(e.target.value)}
                      className="w-full bg-white border border-zinc-300 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-black text-zinc-900 font-semibold shadow-lg"
                    />
                  </form>
                  {mapSearchResults.length > 0 && (
                    <div className="mt-1 bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                      {mapSearchResults.map((result) => (
                        <button
                          key={result.place_id}
                          onClick={() => handleSearchResultClick(result)}
                          className="w-full text-left px-4 py-2.5 text-xs text-zinc-700 font-medium hover:bg-zinc-50 border-b border-zinc-100 last:border-b-0 transition-all cursor-pointer"
                        >
                          <MapPin className="h-3 w-3 inline mr-1.5 text-zinc-400" />
                          {result.display_name.length > 80 ? result.display_name.substring(0, 80) + '...' : result.display_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Full remaining area detail view */}
              {selectedReport && (
                <div className="absolute inset-0 bg-white flex flex-col z-10 overflow-hidden text-zinc-900">
                  <div className="p-5 border-b border-zinc-200 bg-white flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => { setSelectedReport(null); setResolvePhoto(null); }}
                        className="mr-2 px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold uppercase tracking-wider hover:bg-zinc-50 transition-all cursor-pointer"
                      >
                        ← Back to Map
                      </button>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="font-black text-black text-lg uppercase tracking-tight m-0">{selectedReport.category}</h2>
                          {getStatusBadge(selectedReport.status)}
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-zinc-100 text-zinc-800 border border-zinc-200">
                            Severity: {selectedReport.severity}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 font-mono m-0 mt-1">Area / Colony: {selectedReport.colony_area || 'Unknown'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { setSelectedReport(null); setResolvePhoto(null); }}
                      className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-500 hover:text-black transition-all cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="flex-1 flex overflow-hidden">
                    {/* Left Column: Details */}
                    <div className="w-7/12 border-r border-zinc-200 overflow-y-auto p-6 space-y-6">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wide">YOLOv8 Privacy Blurring</span>
                          <button onClick={() => setShowBlurOriginal(!showBlurOriginal)} className="text-xs text-black hover:underline font-bold uppercase tracking-wider cursor-pointer">
                            Show {showBlurOriginal ? 'Blurred' : 'Original'}
                          </button>
                        </div>
                        <div className="relative rounded-2xl overflow-hidden aspect-video bg-zinc-100 border border-zinc-200 shadow-sm max-h-[380px]">
                          <img
                            src={showBlurOriginal ? selectedReport.original_media_url || '' : selectedReport.s3_media_url || ''}
                            alt="Report media"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-3 left-3 bg-black/85 px-2.5 py-1.5 rounded-lg text-[9px] font-bold text-white uppercase tracking-wider">
                            {showBlurOriginal ? 'Original Image' : 'Faces & Plates Anonymized'}
                          </div>
                        </div>
                      </div>

                      <div className="bg-zinc-50 border border-zinc-200 p-5 rounded-2xl">
                        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-2">Problem Statement</h3>
                        <p className="text-sm text-zinc-700 font-medium leading-relaxed m-0">
                          {selectedReport.description || 'No description provided.'}
                        </p>
                      </div>

                      {/* Vote section with single-vote enforcement */}
                      <div className="bg-zinc-50 border border-zinc-200 p-5 rounded-2xl space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Validation Rate</span>
                          <span className="text-xs font-black text-black">
                            {Math.round((selectedReport.upvotes / (selectedReport.upvotes + selectedReport.downvotes || 1)) * 100)}% Verified
                          </span>
                        </div>
                        <div className="h-2.5 w-full bg-zinc-200 rounded-full overflow-hidden">
                          <div className="h-full bg-black" style={{ width: `${(selectedReport.upvotes / (selectedReport.upvotes + selectedReport.downvotes || 1)) * 100}%` }} />
                        </div>
                        <div className="flex justify-between items-center text-xs text-zinc-500 font-bold">
                          <span>{selectedReport.upvotes} Upvotes</span>
                          <span>{selectedReport.downvotes} Downvotes</span>
                        </div>
                        <div className="flex gap-3 pt-1">
                          <button
                            onClick={() => handleVote(selectedReport.id, 'up')}
                            disabled={votedReports.has(selectedReport.id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${
                              votedReports.has(selectedReport.id)
                                ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed border border-zinc-200'
                                : 'bg-black hover:bg-zinc-800 border border-black text-white cursor-pointer'
                            }`}
                          >
                            <ThumbsUp className="h-4 w-4" />
                            {votedReports.has(selectedReport.id) ? 'Already Voted' : 'Verify Issue'}
                          </button>
                          <button
                            onClick={() => handleVote(selectedReport.id, 'down')}
                            disabled={votedReports.has(selectedReport.id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${
                              votedReports.has(selectedReport.id)
                                ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200'
                                : 'bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-800 cursor-pointer'
                            }`}
                          >
                            <ThumbsDown className="h-4 w-4" />
                            {votedReports.has(selectedReport.id) ? 'Already Voted' : 'Flag as Inaccurate'}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                          <span className="text-[10px] text-zinc-500 font-black uppercase tracking-wider">Reported Date</span>
                          <p className="font-extrabold text-black mt-1 text-sm">{new Date(selectedReport.created_at).toLocaleString()}</p>
                        </div>
                        <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                          <span className="text-[10px] text-zinc-500 font-black uppercase tracking-wider">Severity Level</span>
                          <p className="font-extrabold mt-1 text-black text-sm">{selectedReport.severity}</p>
                        </div>
                      </div>

                      {/* Resolution Authority — only for Government/Company */}
                      {(currentUser.role === 'government' || currentUser.role === 'company') && selectedReport.status !== 'Resolved' && (
                        <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl space-y-3">
                          <div className="flex items-center gap-2">
                            <Landmark className="h-4 w-4 text-amber-700" />
                            <h3 className="text-[10px] font-black text-amber-700 uppercase tracking-wider m-0">Resolution Authority</h3>
                          </div>
                          <p className="text-xs text-amber-800 font-medium">Upload a photo of the completed work to mark this issue as resolved.</p>
                          {resolvePhoto ? (
                            <div className="relative rounded-xl overflow-hidden aspect-video border border-amber-300 bg-amber-100">
                              <img src={resolvePhoto} alt="Resolution proof" className="w-full h-full object-cover" />
                              <button type="button" onClick={() => setResolvePhoto(null)} className="absolute top-2 right-2 bg-black/80 hover:bg-black text-white p-1 rounded-full cursor-pointer">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <label className="border-2 border-dashed border-amber-300 hover:border-amber-500 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all bg-white">
                              <Camera className="h-6 w-6 text-amber-500" />
                              <span className="text-xs text-amber-700 font-bold">Upload Completion Photo</span>
                              <input type="file" accept="image/*" onChange={handleResolvePhotoUpload} className="hidden" />
                            </label>
                          )}
                          <button
                            onClick={handleResolveReport}
                            disabled={!resolvePhoto}
                            className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                              resolvePhoto
                                ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer'
                                : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                            }`}
                          >
                            <CheckCircle2 className="h-4 w-4 inline mr-1.5" />
                            Confirm Resolution
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Discussion */}
                    <div className="w-5/12 flex flex-col bg-zinc-50/30 overflow-hidden">
                      <div className="p-5 border-b border-zinc-200 bg-white flex justify-between items-center">
                        <h4 className="text-xs font-black text-black uppercase tracking-wider m-0">Discussion Board ({selectedReport.comments.length})</h4>
                      </div>
                      <div className="flex-1 overflow-y-auto p-5 space-y-3">
                        {selectedReport.comments.length === 0 ? (
                          <div className="text-center py-12 text-zinc-400">
                            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-xs font-semibold italic">No comments yet. Start the conversation below.</p>
                          </div>
                        ) : (
                          selectedReport.comments.map((comment: Comment, index: number) => (
                            <div key={index} className="bg-white p-4 rounded-2xl border border-zinc-200 space-y-1 shadow-sm">
                              <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500">
                                <span className="text-black font-extrabold">{comment.author}</span>
                                <span>{new Date(comment.created_at).toLocaleDateString()}</span>
                              </div>
                              <p className="text-xs text-zinc-700 font-medium leading-relaxed">{comment.text}</p>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="p-4 border-t border-zinc-200 bg-white">
                        <form onSubmit={handleAddComment} className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Type a comment or status update..."
                            value={commentInput}
                            onChange={(e) => setCommentInput(e.target.value)}
                            className="flex-1 bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-black focus:bg-white text-zinc-900 font-semibold"
                          />
                          <button type="submit" className="bg-black hover:bg-zinc-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer">
                            Post
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Chatbot */}
              <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end">
                {isChatOpen && (
                  <div className="w-[380px] h-[500px] bg-white rounded-2xl shadow-2xl border border-zinc-200 flex flex-col overflow-hidden text-zinc-900 mb-3">
                    <div className="p-4 bg-black text-white flex items-center justify-between flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <div className="bg-zinc-800 p-1.5 rounded-lg">
                          <Bot className="h-4 w-4 text-white animate-pulse" />
                        </div>
                        <div>
                          <h3 className="text-xs font-black uppercase tracking-wider m-0 leading-tight">
                            {chatbotLanguage === 'HI' ? 'नागरिक सहायक' : 'Civic Assistant'}
                          </h3>
                          <span className="text-[9px] text-zinc-400 font-bold">
                            {chatbotLanguage === 'HI' ? 'समस्याओं की तुरंत रिपोर्ट करें' : 'Report Issues Instantly'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* HINDI / ENGLISH LANGUAGE TOGGLE BUTTON */}
                        <button
                          onClick={() => setChatbotLanguage(prev => prev === 'EN' ? 'HI' : 'EN')}
                          className="flex items-center gap-1 bg-zinc-800 text-white text-[10px] font-black uppercase tracking-wider px-2 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 transition-all cursor-pointer"
                        >
                          <Globe className="h-3 w-3" />
                          <span>{chatbotLanguage === 'EN' ? 'HINDI' : 'ENGLISH'}</span>
                        </button>
                        <button onClick={() => setIsChatOpen(false)} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50">
                      {chatMessages.map((msg: { sender: string; text: string; options?: string[] }, idx: number) => (
                        <div key={idx} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                          <div className={`p-3 rounded-2xl max-w-[85%] text-xs font-medium shadow-sm leading-relaxed ${
                            msg.sender === 'user' ? 'bg-black text-white rounded-tr-none' : 'bg-white border border-zinc-200 text-zinc-800 rounded-tl-none'
                          }`}>
                            {msg.text}
                          </div>
                          {msg.options && (
                            <div className="flex flex-wrap gap-1.5 mt-2 max-w-[90%]">
                              {msg.options.map((opt: string, oIdx: number) => (
                                <button
                                  key={oIdx}
                                  onClick={() => handleSendChatMessage(opt)}
                                  className="bg-white hover:bg-black hover:text-white text-zinc-800 border border-zinc-300 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg shadow-sm transition-all cursor-pointer"
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                    <div className="p-3 border-t border-zinc-200 bg-white flex-shrink-0">
                      <button
                        type="button"
                        onClick={handleAttachLocation}
                        className="w-full flex items-center justify-center gap-1.5 mb-2 text-[10px] font-bold text-zinc-500 hover:text-black bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 hover:border-zinc-400 rounded-xl py-1.5 transition-all cursor-pointer"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        {chatbotLanguage === 'HI' ? '📍 लाइव स्थान साझा करें' : '📍 Attach Live Location'}
                      </button>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder={chatbotLanguage === 'HI' ? 'अपना संदेश लिखें...' : 'Type your message...'}
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                          className="flex-1 bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-black text-zinc-900 font-semibold"
                        />
                        <button onClick={() => handleSendChatMessage()} className="bg-black hover:bg-zinc-800 text-white p-2 rounded-xl transition-all cursor-pointer">
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => setIsChatOpen(!isChatOpen)}
                  className="bg-black hover:bg-zinc-800 text-white p-4 rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <Bot className="h-6 w-6" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- Leaderboard Tab --- */}
        {activeTab === 'leaderboard' && (
          <div className="flex-1 p-8 overflow-y-auto bg-white flex justify-center">
            <div className="w-full max-w-6xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black uppercase text-black font-sans tracking-tight">Civic Leaderboard</h2>
                  <p className="text-xs text-zinc-500 font-semibold">Top community members ranked by Hero Points.</p>
                </div>
                {/* Daily, Weekly, Monthly, Overall time filters */}
                <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl border border-zinc-200">
                  {['daily', 'weekly', 'monthly', 'overall'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setLeaderboardFilter(tab as any)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        leaderboardFilter === tab ? 'bg-black text-white' : 'text-zinc-600 hover:text-black'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Upper row: Split banner: Reward progress on Left, My Badge Case on Right */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Card: Reward tracker */}
                <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
                  <div className="space-y-2 flex-1 w-full">
                    <div className="flex items-center gap-2">
                      <Gift className="h-5 w-5 text-amber-400" />
                      <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 m-0">🏆 CIVIC REWARD SCHEME</h3>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed font-semibold">
                      Earn ₹1,000 for every 10 verified hyperlocal reports. Let's make our streets better!
                    </p>
                    <div className="pt-2">
                      <div className="flex justify-between items-center text-[10px] font-extrabold uppercase text-zinc-400 mb-1.5">
                        <span>Your Claim Progress: {claimProgress} / 10 Reports</span>
                        <span className="text-amber-400">₹1,000 Target</span>
                      </div>
                      <div className="h-3 w-full bg-zinc-850 rounded-full overflow-hidden border border-zinc-700">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${claimProgress * 10}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="bg-zinc-800 border border-zinc-700 px-5 py-4 rounded-2xl text-center flex flex-col justify-center min-w-[140px] flex-shrink-0">
                    <span className="text-[10px] text-zinc-400 uppercase font-black tracking-wider">Total Claimed</span>
                    <span className="text-xl font-black text-white mt-0.5">₹{totalClaimed.toLocaleString()}</span>
                    <span className="text-[8px] text-emerald-450 font-bold uppercase mt-1">Next: ₹1,000</span>
                  </div>
                </div>

                {/* Right Card: My Badge Case */}
                <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-5 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Award className="h-4 w-4 text-black" />
                    <span className="text-xs font-black uppercase tracking-wider text-black">My Badge Case</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="flex flex-col items-center p-2 rounded-xl bg-white border border-zinc-200 group relative">
                      <span className="text-lg">🥇</span>
                      <span className="text-[8px] font-black uppercase text-zinc-500 mt-1">Legend</span>
                      <div className="absolute bottom-full mb-2 hidden group-hover:block bg-zinc-900 text-white text-[8px] font-bold py-1 px-2 rounded whitespace-nowrap shadow-lg">Earned by rank #1</div>
                    </div>
                    <div className="flex flex-col items-center p-2 rounded-xl bg-white border border-zinc-200 group relative">
                      <span className="text-lg">🛡️</span>
                      <span className="text-[8px] font-black uppercase text-zinc-500 mt-1">Guardian</span>
                      <div className="absolute bottom-full mb-2 hidden group-hover:block bg-zinc-900 text-white text-[8px] font-bold py-1 px-2 rounded whitespace-nowrap shadow-lg">Earned for 5 resolutions</div>
                    </div>
                    <div className="flex flex-col items-center p-2 rounded-xl bg-zinc-150 border border-zinc-200 opacity-50 group relative">
                      <span className="text-lg filter grayscale">🚗</span>
                      <span className="text-[8px] font-black uppercase text-zinc-400 mt-1">Patrol</span>
                      <div className="absolute bottom-full mb-2 hidden group-hover:block bg-zinc-900 text-white text-[8px] font-bold py-1 px-2 rounded whitespace-nowrap shadow-lg">Pothole Patrol (3/5 filed)</div>
                    </div>
                    <div className="flex flex-col items-center p-2 rounded-xl bg-zinc-150 border border-zinc-200 opacity-50 group relative">
                      <span className="text-lg filter grayscale">🌱</span>
                      <span className="text-[8px] font-black uppercase text-zinc-400 mt-1">Eco Hero</span>
                      <div className="absolute bottom-full mb-2 hidden group-hover:block bg-zinc-900 text-white text-[8px] font-bold py-1 px-2 rounded whitespace-nowrap shadow-lg">Waste cleanup drive (0/1 verified)</div>
                    </div>
                  </div>
                  <div className="text-[8px] text-zinc-400 font-extrabold uppercase mt-2 tracking-wide text-center">Unlock badges to boost score multiplier!</div>
                </div>
              </div>

              {/* Lower Section: 70/30 Split Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* 70% Columns: Main Leaderboard Table */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-white rounded-3xl overflow-hidden border border-zinc-200 shadow-sm">
                    <div className="grid grid-cols-12 bg-zinc-50 p-4 border-b border-zinc-200 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                      <div className="col-span-1 text-center">Rank</div>
                      <div className="col-span-5">Community Member</div>
                      <div className="col-span-2 text-right">Hero Points</div>
                      <div className="col-span-4 pl-8">Milestones</div>
                    </div>
                    <div className="divide-y divide-zinc-200">
                      {MOCK_LEADERBOARDS[leaderboardFilter].map((user) => {
                        // Custom impact text mappings for each user
                        let impactTxt = "Verified 2 road reports";
                        if (user.name === 'Arjun Patel') impactTxt = "Verified 14 broken infrastructure reports";
                        else if (user.name === 'Priya Sharma') impactTxt = "Verified 8 garbage reports";
                        else if (user.name === 'Vikram Singh') impactTxt = "Verified 6 water leak reports";
                        else if (user.name === 'Ananya Gupta') impactTxt = "Verified 3 broken infrastructure reports";

                        return (
                          <div key={user.rank} className="grid grid-cols-12 p-4 py-5 items-center text-sm hover:bg-zinc-50/50 transition-all">
                            <div className="col-span-1 text-center font-black text-zinc-500">
                              {user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : `#${user.rank}`}
                            </div>
                            <div className="col-span-5 flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full ${user.avatarColor} flex items-center justify-center text-xs font-bold text-white shadow-sm`}>
                                {user.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-extrabold text-black truncate leading-snug">{user.name}</span>
                                <span className="text-[9px] text-zinc-400 font-bold truncate mt-0.5">{impactTxt}</span>
                              </div>
                            </div>
                            <div className="col-span-2 text-right font-mono font-bold text-black">
                              {user.points.toLocaleString()}
                            </div>
                            <div className="col-span-4 flex flex-wrap gap-1 pl-8">
                              {user.badges.map((badge, idx) => (
                                <span key={idx} className="bg-zinc-100 text-zinc-700 border border-zinc-200 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider">
                                  🏅 {badge}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 30% Columns: Quests Sidebar */}
                <div className="space-y-6">
                  {/* Active Challenges / Quests */}
                  <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-5 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase text-black m-0 tracking-wider">Active Quests</h3>
                      <span className="text-[8px] bg-black text-white px-2 py-0.5 rounded-full font-bold uppercase">Weekly Reset</span>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-white border border-zinc-200 rounded-2xl p-3.5 space-y-2.5">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[10px] font-black text-black uppercase leading-tight">Weekend Pothole Patrol</span>
                          <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-150 flex-shrink-0">+20 pts</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 font-semibold m-0 leading-normal">
                          Report 2 road issues in Indiranagar area before Sunday night.
                        </p>
                        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-zinc-405">
                          <span>Progress: 1 / 2 reported</span>
                          <span className="text-black">50%</span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
                          <div className="h-full bg-black rounded-full" style={{ width: '50%' }} />
                        </div>
                      </div>

                      <div className="bg-white border border-zinc-200 rounded-2xl p-3.5 space-y-2.5">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[10px] font-black text-black uppercase leading-tight">The Validator Challenge</span>
                          <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-150 flex-shrink-0">+15 pts</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 font-semibold m-0 leading-normal">
                          Verify 3 pending waste management entries near your colony.
                        </p>
                        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-zinc-405">
                          <span>Progress: 0 / 3 verified</span>
                          <span className="text-black">0%</span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
                          <div className="h-full bg-black rounded-full" style={{ width: '0%' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Section 2: Top Performers (Complete New Section in Leaderboard) */}
              <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm mt-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-lg font-black uppercase text-black font-sans tracking-tight">Top Performers</h3>
                    <p className="text-xs text-zinc-500 font-semibold">Rankings by issue resolution rate and volume.</p>
                  </div>
                  <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl border border-zinc-200 self-start md:self-auto">
                    {(['sector', 'city', 'state'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setTopPerformersType(type)}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                          topPerformersType === type ? 'bg-black text-white shadow-sm' : 'text-zinc-600 hover:text-black'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-12 bg-zinc-50 p-4 border border-zinc-200 rounded-t-2xl text-[10px] font-black uppercase tracking-wider text-zinc-500">
                  <div className="col-span-1 text-center">Rank</div>
                  <div className="col-span-5">Name</div>
                  <div className="col-span-4">Resolution Rate</div>
                  <div className="col-span-2 text-right">Activity Volume</div>
                </div>
                <div className="divide-y divide-zinc-200 border-x border-b border-zinc-200 rounded-b-2xl overflow-hidden">
                  {MOCK_TOP_PERFORMERS[topPerformersType].map((item) => (
                    <div key={item.rank} className="grid grid-cols-12 p-4 py-5 items-center text-sm hover:bg-zinc-50/50 transition-all bg-white">
                      <div className="col-span-1 text-center font-black text-zinc-500">
                        {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`}
                      </div>
                      <div className="col-span-5 font-extrabold text-black uppercase tracking-tight">
                        {item.name}
                      </div>
                      <div className="col-span-4 flex items-center gap-3">
                        <span className="font-mono font-bold text-black min-w-[36px]">{item.rate}</span>
                        <div className="h-2 w-full max-w-[150px] bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
                          <div className="h-full bg-emerald-500" style={{ width: item.rate }} />
                        </div>
                      </div>
                      <div className="col-span-2 text-right text-xs text-zinc-500 font-bold">
                        {item.count}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- Analytics Tab --- */}
        {activeTab === 'analytics' && (
          <div className="flex-1 p-8 overflow-y-auto bg-white flex justify-center">
            <div className="w-full max-w-4xl space-y-8">
              <div>
                <h2 className="text-xl font-black uppercase text-black">Civic Impact Analytics</h2>
                <p className="text-xs text-zinc-500">Real-time statistics on hyperlocal civic resolutions.</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-zinc-50 border border-zinc-200 p-5 rounded-2xl flex items-center justify-between shadow-sm">
                  <div>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Total Reports</span>
                    <p className="text-2xl font-black text-black mt-1">1,482</p>
                    <span className="text-[9px] text-zinc-500 font-semibold">+14% vs last week</span>
                  </div>
                  <div className="bg-black p-2.5 rounded-xl">
                    <Activity className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="bg-zinc-50 border border-zinc-200 p-5 rounded-2xl flex items-center justify-between shadow-sm">
                  <div>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Resolution Rate</span>
                    <p className="text-2xl font-black text-black mt-1">82.4%</p>
                    <span className="text-[9px] text-zinc-500 font-semibold">+2.1% efficiency gains</span>
                  </div>
                  <div className="bg-black p-2.5 rounded-xl">
                    <CheckCircle2 className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="bg-zinc-50 border border-zinc-200 p-5 rounded-2xl flex items-center justify-between shadow-sm">
                  <div>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Avg. Fix Time</span>
                    <p className="text-2xl font-black text-black mt-1">3.4 Days</p>
                    <span className="text-[9px] text-zinc-500 font-semibold">Under target of 5.0 days</span>
                  </div>
                  <div className="bg-black p-2.5 rounded-xl">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>

              {/* NEW SECTION: ONGOING REPAIR WORK (BEFORE / AFTER COMPARISON IMAGES) */}
              <div className="bg-zinc-50 border border-zinc-200 p-6 rounded-3xl space-y-4 shadow-sm">
                <div>
                  <h3 className="text-xs font-black uppercase text-black">Ongoing Repairs & Proof of Work</h3>
                  <p className="text-[10px] text-zinc-500">Live before and after validation feeds from ground teams.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {MOCK_ONGOING_REPAIRS.map((repair, idx) => (
                    <div key={idx} className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="text-xs font-black text-black uppercase tracking-tight">{repair.title}</h4>
                          <span className="text-[9px] text-zinc-500 font-bold">{repair.location}</span>
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                          repair.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {repair.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest block text-center">Before</span>
                          <div className="rounded-lg overflow-hidden h-28 border border-zinc-200 bg-zinc-100">
                            <img
                              src={repair.beforeUrl}
                              alt="Before repair"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const el = e.currentTarget.parentElement!;
                                e.currentTarget.remove();
                                el.innerHTML = '<div class="w-full h-full flex flex-col items-center justify-center gap-1"><svg xmlns=\'http://www.w3.org/2000/svg\' class=\'h-6 w-6 text-zinc-300\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'currentColor\'><path stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z\' /></svg><span class=\'text-[9px] text-zinc-400 font-bold uppercase tracking-wider\'>Awaiting Upload</span></div>';
                              }}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest block text-center">After / Current</span>
                          <div className="rounded-lg overflow-hidden h-28 border border-zinc-250">
                            <img src={repair.afterUrl} alt="After repair" className="w-full h-full object-cover" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* NEW SECTION: REWARDED CANDIDATES */}
              <div className="bg-zinc-50 border border-zinc-200 p-6 rounded-3xl space-y-4 shadow-sm">
                <div>
                  <h3 className="text-xs font-black uppercase text-black">Rewarded Candidates</h3>
                  <p className="text-[10px] text-zinc-500">Citizens rewarded for filing verified civic problems.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {MOCK_REWARDED_CANDIDATES.map((cand, idx) => (
                    <div key={idx} className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full ${cand.avatarColor} flex items-center justify-center text-xs font-bold text-white shadow-sm flex-shrink-0`}>
                        {cand.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="text-xs font-black text-black truncate">{cand.name}</h4>
                        <p className="text-[9px] text-zinc-500 font-semibold m-0">{cand.verifiedReports} verified reports</p>
                        <p className="text-[10px] text-emerald-600 font-extrabold m-0 mt-0.5">₹{cand.rewardsClaimed.toLocaleString()} earned</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-50 border border-zinc-200 p-5 rounded-2xl space-y-4 shadow-sm">
                  <h3 className="text-xs font-black uppercase text-black">Reports by Category</h3>
                  <div className="space-y-3">
                    {[
                      { name: 'Pothole', count: 684, percent: 70, color: 'bg-zinc-900' },
                      { name: 'Waste / Garbage', count: 320, percent: 45, color: 'bg-zinc-700' },
                      { name: 'Water Leak', count: 184, percent: 25, color: 'bg-zinc-500' },
                      { name: 'Broken Infrastructure', count: 210, percent: 30, color: 'bg-zinc-400' },
                      { name: 'Graffiti', count: 84, percent: 12, color: 'bg-zinc-300' }
                    ].map((cat, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold text-zinc-700">
                          <span>{cat.name}</span>
                          <span className="text-black font-extrabold">{cat.count}</span>
                        </div>
                        <div className="h-2 w-full bg-zinc-200 rounded-full overflow-hidden">
                          <div className={`h-full ${cat.color}`} style={{ width: `${cat.percent}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-zinc-50 border border-zinc-200 p-5 rounded-2xl flex flex-col justify-between shadow-sm">
                  <h3 className="text-xs font-black uppercase text-black mb-2">Resolution Speed Trend</h3>
                  <div className="w-full flex-1 min-h-[160px] flex items-center justify-center">
                    <svg className="w-full h-full" viewBox="0 0 300 120" preserveAspectRatio="none">
                      <line x1="0" y1="20" x2="300" y2="20" stroke="#e4e4e7" strokeWidth="1" />
                      <line x1="0" y1="60" x2="300" y2="60" stroke="#e4e4e7" strokeWidth="1" />
                      <line x1="0" y1="100" x2="300" y2="100" stroke="#e4e4e7" strokeWidth="1" />
                      <path d="M 10 100 L 60 85 L 110 70 L 160 50 L 210 55 L 260 40 Q 280 30 290 25" fill="none" stroke="#000000" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="10" cy="100" r="4.5" fill="#000000" />
                      <circle cx="60" cy="85" r="4.5" fill="#000000" />
                      <circle cx="110" cy="70" r="4.5" fill="#000000" />
                      <circle cx="160" cy="50" r="4.5" fill="#000000" />
                      <circle cx="210" cy="55" r="4.5" fill="#000000" />
                      <circle cx="260" cy="40" r="4.5" fill="#000000" />
                      <circle cx="290" cy="25" r="4.5" fill="#000000" />
                    </svg>
                  </div>
                  <div className="flex justify-between text-[9px] text-zinc-400 font-bold uppercase tracking-wider mt-2 pt-2 border-t border-zinc-200">
                    <span>Jan</span>
                    <span>Feb</span>
                    <span>Mar</span>
                    <span>Apr</span>
                    <span>May</span>
                    <span>Jun</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
