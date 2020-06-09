import React, { useContext } from 'react';
import PropTypes from 'prop-types';
import { NavigationContainer } from '@react-navigation/native';
import { AppearanceProvider } from 'react-native-appearance';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider } from 'react-redux';
import RNUserDefaults from 'rn-user-defaults';

import {
	defaultTheme,
	newThemeState,
	subscribeTheme,
	unsubscribeTheme
} from './utils/theme';
import Navigation from './lib/ShareNavigation';
import store from './lib/createStore';
import { supportSystemTheme } from './utils/deviceInfo';
import {
	defaultHeader, themedHeader, getActiveRouteName, navigationTheme
} from './utils/navigation';
import RocketChat, { THEME_PREFERENCES_KEY } from './lib/rocketchat';
import { ThemeContext } from './theme';
import { localAuthenticate } from './utils/localAuthentication';
import ScreenLockedView from './views/ScreenLockedView';

// Outside Stack
import WithoutServersView from './views/WithoutServersView';

// Inside Stack
import ShareListView from './views/ShareListView';
import ShareView from './views/ShareView';
import SelectServerView from './views/SelectServerView';
import { setCurrentScreen } from './utils/log';
import AuthLoadingView from './views/AuthLoadingView';
import { LayoutAnimation } from './utils/layoutAnimation';

const Inside = createStackNavigator();
const InsideStack = () => {
	const { theme } = useContext(ThemeContext);

	const screenOptions = {
		...defaultHeader,
		...themedHeader(theme)
	};
	screenOptions.headerStyle = {
		...screenOptions.headerStyle,
		// TODO: fix on multiple files PR :)
		height: 57
	};

	return (
		<Inside.Navigator screenOptions={screenOptions}>
			<Inside.Screen
				name='ShareListView'
				component={ShareListView}
			/>
			<Inside.Screen
				name='ShareView'
				component={ShareView}
			/>
			<Inside.Screen
				name='SelectServerView'
				component={SelectServerView}
				options={SelectServerView.navigationOptions}
			/>
		</Inside.Navigator>
	);
};

const Outside = createStackNavigator();
const OutsideStack = () => {
	const { theme } = useContext(ThemeContext);

	return (
		<Outside.Navigator screenOptions={{ ...defaultHeader, ...themedHeader(theme) }}>
			<Outside.Screen
				name='WithoutServersView'
				component={WithoutServersView}
				options={WithoutServersView.navigationOptions}
			/>
		</Outside.Navigator>
	);
};

// App
const Stack = createStackNavigator();
export const App = ({ root }) => (
	<Stack.Navigator screenOptions={{ headerShown: false }}>
		<>
			{!root ? (
				<Stack.Screen
					name='AuthLoading'
					component={AuthLoadingView}
				/>
			) : null}
			{root === 'outside' ? (
				<Stack.Screen
					name='OutsideStack'
					component={OutsideStack}
				/>
			) : null}
			{root === 'inside' ? (
				<Stack.Screen
					name='InsideStack'
					component={InsideStack}
				/>
			) : null}
		</>
	</Stack.Navigator>
);

App.propTypes = {
	root: PropTypes.string
};

class Root extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			theme: defaultTheme(),
			themePreferences: {
				currentTheme: supportSystemTheme() ? 'automatic' : 'light',
				darkLevel: 'dark'
			},
			root: ''
		};
		this.init();
	}

	componentWillUnmount() {
		RocketChat.closeShareExtension();
		unsubscribeTheme();
	}

	init = async() => {
		RNUserDefaults.objectForKey(THEME_PREFERENCES_KEY).then(this.setTheme);
		const currentServer = await RNUserDefaults.get('currentServer');
		const token = await RNUserDefaults.get(RocketChat.TOKEN_KEY);

		if (currentServer && token) {
			await localAuthenticate(currentServer);
			this.setState({ root: 'inside' });
			await RocketChat.shareExtensionInit(currentServer);
		} else {
			this.setState({ root: 'outside' });
		}

		const state = Navigation.navigationRef.current.getRootState();
		const currentRouteName = getActiveRouteName(state);
		Navigation.routeNameRef.current = currentRouteName;
		setCurrentScreen(currentRouteName);
	}

	setTheme = (newTheme = {}) => {
		// change theme state
		this.setState(prevState => newThemeState(prevState, newTheme), () => {
			const { themePreferences } = this.state;
			// subscribe to Appearance changes
			subscribeTheme(themePreferences, this.setTheme);
		});
	}

	render() {
		const { theme, root } = this.state;
		const navTheme = navigationTheme(theme);
		return (
			<AppearanceProvider>
				<Provider store={store}>
					<ThemeContext.Provider value={{ theme }}>
						<LayoutAnimation>
							<NavigationContainer
								theme={navTheme}
								ref={Navigation.navigationRef}
								onStateChange={(state) => {
									const previousRouteName = Navigation.routeNameRef.current;
									const currentRouteName = getActiveRouteName(state);
									if (previousRouteName !== currentRouteName) {
										setCurrentScreen(currentRouteName);
									}
									Navigation.routeNameRef.current = currentRouteName;
								}}
							>
								<App root={root} />
							</NavigationContainer>
							<ScreenLockedView />
						</LayoutAnimation>
					</ThemeContext.Provider>
				</Provider>
			</AppearanceProvider>
		);
	}
}

export default Root;
