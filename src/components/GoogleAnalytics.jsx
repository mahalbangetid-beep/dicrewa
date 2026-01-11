import { useEffect, useState } from 'react';
import ReactGA from 'react-ga4';
import { useLocation } from 'react-router-dom';
import { settingsService } from '../services/api';

const GoogleAnalytics = () => {
    const [initialized, setInitialized] = useState(false);
    const location = useLocation();

    useEffect(() => {
        const initializeGA = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;

                const response = await settingsService.getSettings();
                const gaId = response.data?.google_analytics_id;

                if (gaId && !initialized) {
                    ReactGA.initialize(gaId);
                    setInitialized(true);
                    ReactGA.send({ hitType: "pageview", page: location.pathname + location.search });
                }
            } catch (error) {
                console.error('Failed to initialize GA', error);
            }
        };

        if (!initialized) {
            initializeGA();
        }
    }, [initialized]);

    // Track page views on route change
    useEffect(() => {
        if (initialized) {
            ReactGA.send({ hitType: "pageview", page: location.pathname + location.search });
        }
    }, [initialized, location]);

    return null;
};

export default GoogleAnalytics;