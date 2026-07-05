import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Modal,
  StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import {
  Camera,
  MapPin,
  Award,
  Plus,
  Send,
  CloudOff,
  CloudLightning,
  RefreshCw,
  X,
  Shield,
  ThumbsUp,
  Image as ImageIcon
} from 'lucide-react-native';

// --- Types ---
interface OfflineReport {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  description: string;
  imageUri: string | null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'report' | 'profile'>('report');
  
  // Form State
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Offline Caching State
  const [offlineQueue, setOfflineQueue] = useState<OfflineReport[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  // Gamification State
  const [userPoints, setUserPoints] = useState(120);
  const [userLevel, setUserLevel] = useState(2);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [recentBadges, setRecentBadges] = useState<string[]>(['First Reporter', 'Pothole Patrol']);

  // Load offline queue on startup
  useEffect(() => {
    loadOfflineQueue();
  }, []);

  const loadOfflineQueue = async () => {
    try {
      const stored = await AsyncStorage.getItem('@offline_reports');
      if (stored) {
        setOfflineQueue(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to load offline reports', e);
    }
  };

  const saveOfflineQueue = async (queue: OfflineReport[]) => {
    try {
      await AsyncStorage.setItem('@offline_reports', JSON.stringify(queue));
      setOfflineQueue(queue);
    } catch (e) {
      console.warn('Failed to save offline reports', e);
    }
  };

  // Capture GPS Location
  const requestLocation = async () => {
    setIsLocating(true);
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location permission is required to geotag reports.');
      setIsLocating(false);
      return;
    }

    try {
      let loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      setLocation(loc);
    } catch (e) {
      Alert.alert('Error', 'Could not fetch location. Try enabling GPS.');
    } finally {
      setIsLocating(false);
    }
  };

  // Launch Native Camera
  const launchCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  // Submit Report
  const handleSubmit = async () => {
    if (!location) {
      Alert.alert('Location Required', 'Please capture your GPS coordinates first.');
      return;
    }

    setIsSubmitting(true);

    const reportPayload: OfflineReport = {
      id: `rep-${Date.now()}`,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: new Date().toISOString(),
      description,
      imageUri
    };

    if (!isOnline) {
      // Offline queue insertion
      const updatedQueue = [...offlineQueue, reportPayload];
      await saveOfflineQueue(updatedQueue);
      Alert.alert(
        'Saved Offline 📁',
        'You are currently offline. The report has been cached locally and will sync when you regain connection.'
      );
      resetForm();
    } else {
      // Simulate REST upload to backend/spatial service
      setTimeout(async () => {
        // Award points for submitting report
        const pointsEarned = 10;
        const newPoints = userPoints + pointsEarned;
        setUserPoints(newPoints);
        
        // Level up check (every 100 points is a new level)
        const newLevel = Math.floor(newPoints / 100) + 1;
        if (newLevel > userLevel) {
          setUserLevel(newLevel);
          setShowLevelUp(true);
        }

        Alert.alert(
          'Success! 🚀',
          `Report submitted successfully. You earned +${pointsEarned} Hero Points!`
        );
        resetForm();
      }, 1500);
    }
  };

  const syncOfflineQueue = async () => {
    if (offlineQueue.length === 0) return;
    setIsSubmitting(true);
    
    // Simulate syncing all items in batch
    setTimeout(async () => {
      const pointsEarned = offlineQueue.length * 10;
      const newPoints = userPoints + pointsEarned;
      setUserPoints(newPoints);

      const newLevel = Math.floor(newPoints / 100) + 1;
      if (newLevel > userLevel) {
        setUserLevel(newLevel);
        setShowLevelUp(true);
      }

      Alert.alert(
        'Synced! ⚡',
        `Successfully uploaded ${offlineQueue.length} cached reports. Earned +${pointsEarned} Hero Points!`
      );
      await saveOfflineQueue([]);
      setIsSubmitting(false);
    }, 2000);
  };

  const resetForm = () => {
    setDescription('');
    setLocation(null);
    setImageUri(null);
    setIsSubmitting(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header bar */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Shield size={24} color="#38bdf8" />
          <Text style={styles.headerTitle}>Community Hero</Text>
        </View>

        {/* Network status toggler */}
        <TouchableOpacity
          onPress={() => setIsOnline(!isOnline)}
          style={[styles.networkStatus, { borderColor: isOnline ? '#10b981' : '#f59e0b' }]}
        >
          {isOnline ? (
            <CloudLightning size={14} color="#10b981" />
          ) : (
            <CloudOff size={14} color="#f59e0b" />
          )}
          <Text style={[styles.networkStatusText, { color: isOnline ? '#10b981' : '#f59e0b' }]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Tabs */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeTab === 'report' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Report Civic Issue</Text>

            {/* Description */}
            <Text style={styles.label}>Description / Details</Text>
            <TextInput
              style={styles.input}
              placeholder="What needs fixing? (e.g. pothole, broken streetlight...)"
              placeholderTextColor="#64748b"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />

            {/* Camera / Photo */}
            <Text style={styles.label}>Photo Evidence</Text>
            {imageUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                <TouchableOpacity style={styles.removeImage} onPress={() => setImageUri(null)}>
                  <X size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.photoButton} onPress={launchCamera}>
                <ImageIcon size={24} color="#38bdf8" />
                <Text style={styles.photoButtonText}>Take Photo</Text>
              </TouchableOpacity>
            )}

            {/* Geotag GPS */}
            <Text style={styles.label}>Geotag GPS Coordinates</Text>
            {location ? (
              <View style={styles.locationTag}>
                <MapPin size={16} color="#10b981" />
                <Text style={styles.locationTagText}>
                  {location.coords.latitude.toFixed(5)}, {location.coords.longitude.toFixed(5)}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.locationButton}
                onPress={requestLocation}
                disabled={isLocating}
              >
                {isLocating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MapPin size={18} color="#fff" />
                    <Text style={styles.locationButtonText}>Get Current Location</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Send size={18} color="#fff" />
                  <Text style={styles.submitButtonText}>
                    {isOnline ? 'Submit Report' : 'Cache Offline'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          /* Profile / Gamification view */
          <View style={styles.card}>
            <View style={styles.profileHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>JD</Text>
              </View>
              <View>
                <Text style={styles.profileName}>Jane Doe</Text>
                <Text style={styles.profileLevel}>Level {userLevel} Advocate</Text>
              </View>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{userPoints}</Text>
                <Text style={styles.statLabel}>Total Points</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{recentBadges.length}</Text>
                <Text style={styles.statLabel}>Badges</Text>
              </View>
            </View>

            {/* Badges list */}
            <Text style={styles.sectionTitle}>Unlocked Milestones</Text>
            <View style={styles.badgeContainer}>
              {recentBadges.map((badge, idx) => (
                <View key={idx} style={styles.badge}>
                  <Award size={16} color="#fbbf24" />
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Offline cache notice card */}
        {offlineQueue.length > 0 && (
          <View style={styles.offlineAlert}>
            <CloudOff size={20} color="#fbbf24" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.offlineAlertTitle}>
                {offlineQueue.length} Report(s) in Queue
              </Text>
              <Text style={styles.offlineAlertDesc}>
                Awaiting connection to upload.
              </Text>
            </View>
            <TouchableOpacity
              onPress={syncOfflineQueue}
              disabled={isSubmitting}
              style={styles.syncButton}
            >
              <RefreshCw size={14} color="#fff" />
              <Text style={styles.syncButtonText}>Sync</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Level up modal */}
      <Modal visible={showLevelUp} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Award size={64} color="#fbbf24" style={{ marginBottom: 15 }} />
            <Text style={styles.modalTitle}>LEVEL UP! 🎉</Text>
            <Text style={styles.modalDesc}>
              You reached Level {userLevel}! Thank you for making your community safer.
            </Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowLevelUp(false)}>
              <Text style={styles.modalCloseText}>Awesome</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => setActiveTab('report')}
          style={[styles.tab, activeTab === 'report' && styles.activeTab]}
        >
          <Plus size={20} color={activeTab === 'report' ? '#38bdf8' : '#64748b'} />
          <Text style={[styles.tabLabel, { color: activeTab === 'report' ? '#38bdf8' : '#64748b' }]}>
            Report
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('profile')}
          style={[styles.tab, activeTab === 'profile' && styles.activeTab]}
        >
          <Award size={20} color={activeTab === 'profile' ? '#38bdf8' : '#64748b'} />
          <Text style={[styles.tabLabel, { color: activeTab === 'profile' ? '#38bdf8' : '#64748b' }]}>
            Gamification
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070b14'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0a0f1d'
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f3f4f6'
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4
  },
  networkStatusText: {
    fontSize: 11,
    fontWeight: 'bold'
  },
  scrollContent: {
    padding: 20
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 20
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 15
  },
  input: {
    backgroundColor: '#070b14',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    textAlignVertical: 'top'
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#070b14',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    gap: 8
  },
  photoButtonText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '600'
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden'
  },
  imagePreview: {
    width: '100%',
    height: 180,
    resizeMode: 'cover'
  },
  removeImage: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 6,
    borderRadius: 12
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    gap: 8
  },
  locationButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  },
  locationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#05966920',
    borderWidth: 1,
    borderColor: '#05966940',
    padding: 12,
    borderRadius: 12,
    gap: 8
  },
  locationTagText: {
    color: '#34d399',
    fontSize: 14,
    fontWeight: '600'
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    borderRadius: 12,
    padding: 15,
    marginTop: 25,
    gap: 8
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold'
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    backgroundColor: '#0a0f1d',
    paddingVertical: 10
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600'
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginBottom: 20
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff'
  },
  profileLevel: {
    fontSize: 12,
    color: '#38bdf8',
    fontWeight: '600'
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 25
  },
  statBox: {
    flex: 1,
    backgroundColor: '#070b14',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center'
  },
  statNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0ea5e9'
  },
  statLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '600'
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fbbf2415',
    borderWidth: 1,
    borderColor: '#fbbf2430',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6
  },
  badgeText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600'
  },
  offlineAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ca8a0420',
    borderWidth: 1,
    borderColor: '#ca8a0440',
    borderRadius: 16,
    padding: 15,
    marginTop: 10
  },
  offlineAlertTitle: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: 'bold'
  },
  offlineAlertDesc: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 25,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
    width: '100%',
    maxWidth: 320
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10
  },
  modalDesc: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20
  },
  modalClose: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 12
  },
  modalCloseText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14
  }
});
