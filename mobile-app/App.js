"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = App;
var react_1 = require("react");
var react_native_1 = require("react-native");
var async_storage_1 = require("@react-native-async-storage/async-storage");
var Location = require("expo-location");
var ImagePicker = require("expo-image-picker");
var lucide_react_native_1 = require("lucide-react-native");
function App() {
    var _this = this;
    var _a = (0, react_1.useState)('report'), activeTab = _a[0], setActiveTab = _a[1];
    // Form State
    var _b = (0, react_1.useState)(''), description = _b[0], setDescription = _b[1];
    var _c = (0, react_1.useState)(null), location = _c[0], setLocation = _c[1];
    var _d = (0, react_1.useState)(null), imageUri = _d[0], setImageUri = _d[1];
    var _e = (0, react_1.useState)(false), isLocating = _e[0], setIsLocating = _e[1];
    var _f = (0, react_1.useState)(false), isSubmitting = _f[0], setIsSubmitting = _f[1];
    // Offline Caching State
    var _g = (0, react_1.useState)([]), offlineQueue = _g[0], setOfflineQueue = _g[1];
    var _h = (0, react_1.useState)(true), isOnline = _h[0], setIsOnline = _h[1];
    // Gamification State
    var _j = (0, react_1.useState)(120), userPoints = _j[0], setUserPoints = _j[1];
    var _k = (0, react_1.useState)(2), userLevel = _k[0], setUserLevel = _k[1];
    var _l = (0, react_1.useState)(false), showLevelUp = _l[0], setShowLevelUp = _l[1];
    var _m = (0, react_1.useState)(['First Reporter', 'Pothole Patrol']), recentBadges = _m[0], setRecentBadges = _m[1];
    // Load offline queue on startup
    (0, react_1.useEffect)(function () {
        loadOfflineQueue();
    }, []);
    var loadOfflineQueue = function () { return __awaiter(_this, void 0, void 0, function () {
        var stored, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, async_storage_1.default.getItem('@offline_reports')];
                case 1:
                    stored = _a.sent();
                    if (stored) {
                        setOfflineQueue(JSON.parse(stored));
                    }
                    return [3 /*break*/, 3];
                case 2:
                    e_1 = _a.sent();
                    console.warn('Failed to load offline reports', e_1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var saveOfflineQueue = function (queue) { return __awaiter(_this, void 0, void 0, function () {
        var e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, async_storage_1.default.setItem('@offline_reports', JSON.stringify(queue))];
                case 1:
                    _a.sent();
                    setOfflineQueue(queue);
                    return [3 /*break*/, 3];
                case 2:
                    e_2 = _a.sent();
                    console.warn('Failed to save offline reports', e_2);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    // Capture GPS Location
    var requestLocation = function () { return __awaiter(_this, void 0, void 0, function () {
        var status, loc, e_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setIsLocating(true);
                    return [4 /*yield*/, Location.requestForegroundPermissionsAsync()];
                case 1:
                    status = (_a.sent()).status;
                    if (status !== 'granted') {
                        react_native_1.Alert.alert('Permission Denied', 'Location permission is required to geotag reports.');
                        setIsLocating(false);
                        return [2 /*return*/];
                    }
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, 5, 6]);
                    return [4 /*yield*/, Location.getCurrentPositionAsync({
                            accuracy: Location.Accuracy.Balanced
                        })];
                case 3:
                    loc = _a.sent();
                    setLocation(loc);
                    return [3 /*break*/, 6];
                case 4:
                    e_3 = _a.sent();
                    react_native_1.Alert.alert('Error', 'Could not fetch location. Try enabling GPS.');
                    return [3 /*break*/, 6];
                case 5:
                    setIsLocating(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    // Launch Native Camera
    var launchCamera = function () { return __awaiter(_this, void 0, void 0, function () {
        var status, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ImagePicker.requestCameraPermissionsAsync()];
                case 1:
                    status = (_a.sent()).status;
                    if (status !== 'granted') {
                        react_native_1.Alert.alert('Permission Denied', 'Camera permission is required.');
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, ImagePicker.launchCameraAsync({
                            mediaTypes: ImagePicker.MediaTypeOptions.Images,
                            allowsEditing: true,
                            aspect: [16, 9],
                            quality: 0.8
                        })];
                case 2:
                    result = _a.sent();
                    if (!result.canceled && result.assets && result.assets.length > 0) {
                        setImageUri(result.assets[0].uri);
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    // Submit Report
    var handleSubmit = function () { return __awaiter(_this, void 0, void 0, function () {
        var reportPayload, updatedQueue;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!location) {
                        react_native_1.Alert.alert('Location Required', 'Please capture your GPS coordinates first.');
                        return [2 /*return*/];
                    }
                    setIsSubmitting(true);
                    reportPayload = {
                        id: "rep-".concat(Date.now()),
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                        timestamp: new Date().toISOString(),
                        description: description,
                        imageUri: imageUri
                    };
                    if (!!isOnline) return [3 /*break*/, 2];
                    updatedQueue = __spreadArray(__spreadArray([], offlineQueue, true), [reportPayload], false);
                    return [4 /*yield*/, saveOfflineQueue(updatedQueue)];
                case 1:
                    _a.sent();
                    react_native_1.Alert.alert('Saved Offline 📁', 'You are currently offline. The report has been cached locally and will sync when you regain connection.');
                    resetForm();
                    return [3 /*break*/, 3];
                case 2:
                    // Simulate REST upload to backend/spatial service
                    setTimeout(function () { return __awaiter(_this, void 0, void 0, function () {
                        var pointsEarned, newPoints, newLevel;
                        return __generator(this, function (_a) {
                            pointsEarned = 10;
                            newPoints = userPoints + pointsEarned;
                            setUserPoints(newPoints);
                            newLevel = Math.floor(newPoints / 100) + 1;
                            if (newLevel > userLevel) {
                                setUserLevel(newLevel);
                                setShowLevelUp(true);
                            }
                            react_native_1.Alert.alert('Success! 🚀', "Report submitted successfully. You earned +".concat(pointsEarned, " Hero Points!"));
                            resetForm();
                            return [2 /*return*/];
                        });
                    }); }, 1500);
                    _a.label = 3;
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var syncOfflineQueue = function () { return __awaiter(_this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            if (offlineQueue.length === 0)
                return [2 /*return*/];
            setIsSubmitting(true);
            // Simulate syncing all items in batch
            setTimeout(function () { return __awaiter(_this, void 0, void 0, function () {
                var pointsEarned, newPoints, newLevel;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            pointsEarned = offlineQueue.length * 10;
                            newPoints = userPoints + pointsEarned;
                            setUserPoints(newPoints);
                            newLevel = Math.floor(newPoints / 100) + 1;
                            if (newLevel > userLevel) {
                                setUserLevel(newLevel);
                                setShowLevelUp(true);
                            }
                            react_native_1.Alert.alert('Synced! ⚡', "Successfully uploaded ".concat(offlineQueue.length, " cached reports. Earned +").concat(pointsEarned, " Hero Points!"));
                            return [4 /*yield*/, saveOfflineQueue([])];
                        case 1:
                            _a.sent();
                            setIsSubmitting(false);
                            return [2 /*return*/];
                    }
                });
            }); }, 2000);
            return [2 /*return*/];
        });
    }); };
    var resetForm = function () {
        setDescription('');
        setLocation(null);
        setImageUri(null);
        setIsSubmitting(false);
    };
    return (<react_native_1.SafeAreaView style={styles.container}>
      <react_native_1.StatusBar barStyle="light-content"/>

      {/* Header bar */}
      <react_native_1.View style={styles.header}>
        <react_native_1.View style={styles.headerTitleContainer}>
          <lucide_react_native_1.Shield size={24} color="#38bdf8"/>
          <react_native_1.Text style={styles.headerTitle}>Community Hero</react_native_1.Text>
        </react_native_1.View>

        {/* Network status toggler */}
        <react_native_1.TouchableOpacity onPress={function () { return setIsOnline(!isOnline); }} style={[styles.networkStatus, { borderColor: isOnline ? '#10b981' : '#f59e0b' }]}>
          {isOnline ? (<lucide_react_native_1.CloudLightning size={14} color="#10b981"/>) : (<lucide_react_native_1.CloudOff size={14} color="#f59e0b"/>)}
          <react_native_1.Text style={[styles.networkStatusText, { color: isOnline ? '#10b981' : '#f59e0b' }]}>
            {isOnline ? 'Online' : 'Offline'}
          </react_native_1.Text>
        </react_native_1.TouchableOpacity>
      </react_native_1.View>

      {/* Main Tabs */}
      <react_native_1.ScrollView contentContainerStyle={styles.scrollContent}>
        {activeTab === 'report' ? (<react_native_1.View style={styles.card}>
            <react_native_1.Text style={styles.cardTitle}>Report Civic Issue</react_native_1.Text>

            {/* Description */}
            <react_native_1.Text style={styles.label}>Description / Details</react_native_1.Text>
            <react_native_1.TextInput style={styles.input} placeholder="What needs fixing? (e.g. pothole, broken streetlight...)" placeholderTextColor="#64748b" value={description} onChangeText={setDescription} multiline numberOfLines={4}/>

            {/* Camera / Photo */}
            <react_native_1.Text style={styles.label}>Photo Evidence</react_native_1.Text>
            {imageUri ? (<react_native_1.View style={styles.imagePreviewContainer}>
                <react_native_1.Image source={{ uri: imageUri }} style={styles.imagePreview}/>
                <react_native_1.TouchableOpacity style={styles.removeImage} onPress={function () { return setImageUri(null); }}>
                  <lucide_react_native_1.X size={16} color="#fff"/>
                </react_native_1.TouchableOpacity>
              </react_native_1.View>) : (<react_native_1.TouchableOpacity style={styles.photoButton} onPress={launchCamera}>
                <lucide_react_native_1.Image size={24} color="#38bdf8"/>
                <react_native_1.Text style={styles.photoButtonText}>Take Photo</react_native_1.Text>
              </react_native_1.TouchableOpacity>)}

            {/* Geotag GPS */}
            <react_native_1.Text style={styles.label}>Geotag GPS Coordinates</react_native_1.Text>
            {location ? (<react_native_1.View style={styles.locationTag}>
                <lucide_react_native_1.MapPin size={16} color="#10b981"/>
                <react_native_1.Text style={styles.locationTagText}>
                  {location.coords.latitude.toFixed(5)}, {location.coords.longitude.toFixed(5)}
                </react_native_1.Text>
              </react_native_1.View>) : (<react_native_1.TouchableOpacity style={styles.locationButton} onPress={requestLocation} disabled={isLocating}>
                {isLocating ? (<react_native_1.ActivityIndicator color="#fff"/>) : (<>
                    <lucide_react_native_1.MapPin size={18} color="#fff"/>
                    <react_native_1.Text style={styles.locationButtonText}>Get Current Location</react_native_1.Text>
                  </>)}
              </react_native_1.TouchableOpacity>)}

            {/* Submit */}
            <react_native_1.TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (<react_native_1.ActivityIndicator color="#fff"/>) : (<>
                  <lucide_react_native_1.Send size={18} color="#fff"/>
                  <react_native_1.Text style={styles.submitButtonText}>
                    {isOnline ? 'Submit Report' : 'Cache Offline'}
                  </react_native_1.Text>
                </>)}
            </react_native_1.TouchableOpacity>
          </react_native_1.View>) : (
        /* Profile / Gamification view */
        <react_native_1.View style={styles.card}>
            <react_native_1.View style={styles.profileHeader}>
              <react_native_1.View style={styles.avatar}>
                <react_native_1.Text style={styles.avatarText}>JD</react_native_1.Text>
              </react_native_1.View>
              <react_native_1.View>
                <react_native_1.Text style={styles.profileName}>Jane Doe</react_native_1.Text>
                <react_native_1.Text style={styles.profileLevel}>Level {userLevel} Advocate</react_native_1.Text>
              </react_native_1.View>
            </react_native_1.View>

            {/* Stats */}
            <react_native_1.View style={styles.statsRow}>
              <react_native_1.View style={styles.statBox}>
                <react_native_1.Text style={styles.statNumber}>{userPoints}</react_native_1.Text>
                <react_native_1.Text style={styles.statLabel}>Total Points</react_native_1.Text>
              </react_native_1.View>
              <react_native_1.View style={styles.statBox}>
                <react_native_1.Text style={styles.statNumber}>{recentBadges.length}</react_native_1.Text>
                <react_native_1.Text style={styles.statLabel}>Badges</react_native_1.Text>
              </react_native_1.View>
            </react_native_1.View>

            {/* Badges list */}
            <react_native_1.Text style={styles.sectionTitle}>Unlocked Milestones</react_native_1.Text>
            <react_native_1.View style={styles.badgeContainer}>
              {recentBadges.map(function (badge, idx) { return (<react_native_1.View key={idx} style={styles.badge}>
                  <lucide_react_native_1.Award size={16} color="#fbbf24"/>
                  <react_native_1.Text style={styles.badgeText}>{badge}</react_native_1.Text>
                </react_native_1.View>); })}
            </react_native_1.View>
          </react_native_1.View>)}

        {/* Offline cache notice card */}
        {offlineQueue.length > 0 && (<react_native_1.View style={styles.offlineAlert}>
            <lucide_react_native_1.CloudOff size={20} color="#fbbf24"/>
            <react_native_1.View style={{ flex: 1, marginLeft: 10 }}>
              <react_native_1.Text style={styles.offlineAlertTitle}>
                {offlineQueue.length} Report(s) in Queue
              </react_native_1.Text>
              <react_native_1.Text style={styles.offlineAlertDesc}>
                Awaiting connection to upload.
              </react_native_1.Text>
            </react_native_1.View>
            <react_native_1.TouchableOpacity onPress={syncOfflineQueue} disabled={isSubmitting} style={styles.syncButton}>
              <lucide_react_native_1.RefreshCw size={14} color="#fff"/>
              <react_native_1.Text style={styles.syncButtonText}>Sync</react_native_1.Text>
            </react_native_1.TouchableOpacity>
          </react_native_1.View>)}
      </react_native_1.ScrollView>

      {/* Level up modal */}
      <react_native_1.Modal visible={showLevelUp} transparent animationType="fade">
        <react_native_1.View style={styles.modalOverlay}>
          <react_native_1.View style={styles.modalContent}>
            <lucide_react_native_1.Award size={64} color="#fbbf24" style={{ marginBottom: 15 }}/>
            <react_native_1.Text style={styles.modalTitle}>LEVEL UP! 🎉</react_native_1.Text>
            <react_native_1.Text style={styles.modalDesc}>
              You reached Level {userLevel}! Thank you for making your community safer.
            </react_native_1.Text>
            <react_native_1.TouchableOpacity style={styles.modalClose} onPress={function () { return setShowLevelUp(false); }}>
              <react_native_1.Text style={styles.modalCloseText}>Awesome</react_native_1.Text>
            </react_native_1.TouchableOpacity>
          </react_native_1.View>
        </react_native_1.View>
      </react_native_1.Modal>

      {/* Tab bar */}
      <react_native_1.View style={styles.tabBar}>
        <react_native_1.TouchableOpacity onPress={function () { return setActiveTab('report'); }} style={[styles.tab, activeTab === 'report' && styles.activeTab]}>
          <lucide_react_native_1.Plus size={20} color={activeTab === 'report' ? '#38bdf8' : '#64748b'}/>
          <react_native_1.Text style={[styles.tabLabel, { color: activeTab === 'report' ? '#38bdf8' : '#64748b' }]}>
            Report
          </react_native_1.Text>
        </react_native_1.TouchableOpacity>
        <react_native_1.TouchableOpacity onPress={function () { return setActiveTab('profile'); }} style={[styles.tab, activeTab === 'profile' && styles.activeTab]}>
          <lucide_react_native_1.Award size={20} color={activeTab === 'profile' ? '#38bdf8' : '#64748b'}/>
          <react_native_1.Text style={[styles.tabLabel, { color: activeTab === 'profile' ? '#38bdf8' : '#64748b' }]}>
            Gamification
          </react_native_1.Text>
        </react_native_1.TouchableOpacity>
      </react_native_1.View>
    </react_native_1.SafeAreaView>);
}
var styles = react_native_1.StyleSheet.create({
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
