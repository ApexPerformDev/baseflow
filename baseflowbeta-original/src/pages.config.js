import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import RFMMatrix from './pages/RFMMatrix';
import ABCCurve from './pages/ABCCurve';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import CompanySettings from './pages/CompanySettings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "Dashboard": Dashboard,
    "RFMMatrix": RFMMatrix,
    "ABCCurve": ABCCurve,
    "Settings": Settings,
    "Profile": Profile,
    "CompanySettings": CompanySettings,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};