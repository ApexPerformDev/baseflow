import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import RFMMatrix from './pages/RFMMatrix';
import ABCCurve from './pages/ABCCurve';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import CompanySettings from './pages/CompanySettings';
import Login from './pages/Login';
import Register from './pages/Register';
import Pricing from './pages/Pricing';
import Admin from './pages/Admin';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "Dashboard": Dashboard,
    "RFMMatrix": RFMMatrix,
    "ABCCurve": ABCCurve,
    "Settings": Settings,
    "Profile": Profile,
    "CompanySettings": CompanySettings,
    "Login": Login,
    "Register": Register,
    "Pricing": Pricing,
    "Admin": Admin,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};