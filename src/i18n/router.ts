import { Link, NavLink } from 'react-router-dom';
import { registerLocaleTextComponents } from './host';

// Register external text sinks without changing Route/Routes/Fragment identities.
registerLocaleTextComponents(Link, NavLink);
