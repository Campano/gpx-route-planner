/**
 * Internationalization translations
 */

export const translations = {
  en: {
    // Header
    appTitle: "Mountain Route Planner",
    appDescription: "Plan your mountaineering routes with precision",
    
    // Buttons
    routeManager: "Route Manager",
    generalSettings: "General Settings",
    help: "Help",
    routeSettings: "Route Settings",
    exportPDF: "Export PDF",
    addRoute: "New Route",
    close: "Close",
    
    // Route Details
    routeDetails: "Route Details",
    newRoute: "New Route",
    waypoints: "waypoints",
    uploadGPX: "Upload a GPX file to create a new route",
    
    // Table Headers
    location: "Location",
    segment: "Segment",
    route: "Route",
    timing: "Timing",
    segmentTime: "Segment",
    penalty: "Penalty (%)",
    rest: "Rest (min)",
    total: "Total",
    progression: "Prog.",
    time: "Time",
    notes: "Notes",
    
    // Route Manager
    manageRoutes: "Manage your saved routes",
    savedRoutes: "Saved Routes",
    noRoutes: "No routes saved yet",
    clickAddRouteToStart: "Click \"New Route\" to get started",
    deleteRoute: "Delete route",
    
    // Settings
    defaultSettings: "Default Settings",
    configureDefaults: "Configure default speeds and settings for all routes",
    ascentSpeed: "Ascent Speed (m/h)",
    descentSpeed: "Descent Speed (m/h)",
    flatSpeed: "Flat Speed (m/h)",
    startTime: "Starting Time",
    distanceCalculation: "Distance Calculation",
    safetyTime: "Safety Time (%)",
    useDefaults: "Use Defaults",
    
    // Help
    technicalDetails: "Technical Details",
    support: "Support",
    about: "About",
    version: "Version",
    built: "Built",
    author: "Author",
    license: "License",
    
    // Common
    decisionPoint: "Decision point",
    safetyTime: "Safety Time",
    start: "Start",
    end: "End",
    
    // Warning
    betaWarning: "Beta Version: Calculations may be unreliable and must be verified. Please report problems and suggestions on the",
    issuesPage: "Github issues page",
    
    // Additional UI elements
    language: "Language",
    uploadGPXFile: "Upload GPX file",
    dropGPXFileHere: "Drop GPX file here",
    dragDropZone: "Drag and drop a GPX file here, or click to select",
    selectFile: "Select File",
    pleaseDropGPXFile: "Please drop a GPX file (.gpx extension)",
    errorParsingGPXFile: "Error parsing GPX file",
    noFileSelected: "No file selected",
    selectedFile: "Selected file",
    loadRoute: "Load Route",
    deleteRoute: "Delete Route",
    editNotes: "Edit notes",
    noNotes: "No notes",
    resetToDefaults: "Reset to Defaults",
    routeSpecificSettings: "Route-Specific Settings",
    overrideDefaults: "Configure settings for this route (overrides default)",
    
    // Distance calculation options
    trackBased: "Using the track",
    waypointToWaypoint: "Waypoint to waypoint",
    
    // Technical details
    technicalDetailsDesc: "Technical information, support, and version details",
    distanceCalculationDesc: "Uses Haversine formula for accurate distance measurements",
    timeCalculationDesc: "Based on t = d/v formula for different terrain types",
    utmCoordinatesDesc: "Displays coordinates in Universal Transverse Mercator format",
    safetyBufferDesc: "Configurable percentage-based safety time added to total route time",
    gpxParsingDesc: "Supports both track-based and waypoint-to-waypoint distance calculations",
    pdfExportDesc: "Generates professional route cards with all planning data",
    
    // Technical detail labels
    distanceCalculation: "Distance Calculation",
    timeCalculation: "Time Calculation", 
    utmCoordinates: "UTM Coordinates",
    safetyBuffer: "Safety Buffer",
    gpxParsing: "GPX Parsing",
    pdfExport: "PDF Export",
    
    // Support
    reportIssues: "Report issues and suggestions:",
    githubIssuesPage: "GitHub Issues Page",
    
    // Other Tools
    otherTools: "Other Tools",
    otherToolsDesc: "Useful tools for GPX file editing and visualization",
    gpxStudio: "GPX Studio",
    gpxStudioDesc: "Online GPX file editor with route planning capabilities",
    gpsVisualizer: "GPS Visualizer",
    gpsVisualizerDesc: "Profile builder and data visualization tools",
    
    // About
    packageManager: "Package Manager",
  },
  
  fr: {
    // Header
    appTitle: "Planificateur de Routes Montagne",
    appDescription: "Planifiez vos routes d'alpinisme avec précision",
    
    // Buttons
    routeManager: "Gestionnaire de Routes",
    generalSettings: "Paramètres Généraux",
    help: "Aide",
    routeSettings: "Paramètres de Route",
    exportPDF: "Exporter PDF",
    addRoute: "Nouvelle Route",
    close: "Fermer",
    
    // Route Details
    routeDetails: "Détails de la Route",
    newRoute: "Nouvelle Route",
    waypoints: "points de passage",
    uploadGPX: "Téléchargez un fichier GPX pour créer une nouvelle route",
    
    // Table Headers
    location: "Emplacement",
    segment: "Segment",
    route: "Route",
    timing: "Chronométrage",
    segmentTime: "Segment",
    penalty: "Pénalité (%)",
    rest: "Repos (min)",
    total: "Total",
    progression: "Prog.",
    time: "Heure",
    notes: "Notes",
    
    // Route Manager
    manageRoutes: "Gérez vos routes sauvegardées",
    savedRoutes: "Routes Sauvegardées",
    noRoutes: "Aucune route sauvegardée",
    clickAddRouteToStart: "Cliquez sur \"Nouvelle Route\" pour commencer",
    deleteRoute: "Supprimer la route",
    
    // Settings
    defaultSettings: "Paramètres par Défaut",
    configureDefaults: "Configurez les vitesses et paramètres par défaut pour toutes les routes",
    ascentSpeed: "Vitesse de Montée (m/h)",
    descentSpeed: "Vitesse de Descente (m/h)",
    flatSpeed: "Vitesse sur Terrain Plat (m/h)",
    startTime: "Heure de Départ",
    distanceCalculation: "Calcul de Distance",
    safetyTime: "Temps de Sécurité (%)",
    useDefaults: "Utiliser les Défauts",
    
    // Help
    technicalDetails: "Détails Techniques",
    support: "Support",
    about: "À Propos",
    version: "Version",
    built: "Construit",
    author: "Auteur",
    license: "Licence",
    
    // Common
    decisionPoint: "Point de décision",
    safetyTime: "Temps de Sécurité",
    start: "Départ",
    end: "Arrivée",
    
    // Warning
    betaWarning: "Version Bêta: Les calculs peuvent être peu fiables et doivent être vérifiés. Veuillez signaler les problèmes et suggestions sur la",
    issuesPage: "page des problèmes Github",
    
    // Additional UI elements
    language: "Langue",
    uploadGPXFile: "Télécharger fichier GPX",
    dropGPXFileHere: "Déposez le fichier GPX ici",
    dragDropZone: "Glissez-déposez un fichier GPX ici, ou cliquez pour sélectionner",
    selectFile: "Sélectionner Fichier",
    pleaseDropGPXFile: "Veuillez déposer un fichier GPX (extension .gpx)",
    errorParsingGPXFile: "Erreur lors de l'analyse du fichier GPX",
    noFileSelected: "Aucun fichier sélectionné",
    selectedFile: "Fichier sélectionné",
    loadRoute: "Charger Route",
    deleteRoute: "Supprimer Route",
    editNotes: "Modifier notes",
    noNotes: "Aucune note",
    resetToDefaults: "Réinitialiser aux Défauts",
    routeSpecificSettings: "Paramètres Spécifiques à la Route",
    overrideDefaults: "Configurez les paramètres pour cette route (remplace les défauts)",
    
    // Distance calculation options
    trackBased: "En utilisant la piste",
    waypointToWaypoint: "Point de passage à point de passage",
    
    // Technical details
    technicalDetailsDesc: "Informations techniques, support et détails de version",
    distanceCalculationDesc: "Utilise la formule de Haversine pour des mesures de distance précises",
    timeCalculationDesc: "Basé sur la formule t = d/v pour différents types de terrain",
    utmCoordinatesDesc: "Affiche les coordonnées au format Universal Transverse Mercator",
    safetyBufferDesc: "Temps de sécurité basé sur un pourcentage configurable ajouté au temps total de la route",
    gpxParsingDesc: "Supporte les calculs de distance basés sur la piste et point de passage à point de passage",
    pdfExportDesc: "Génère des cartes de route professionnelles avec toutes les données de planification",
    
    // Technical detail labels
    distanceCalculation: "Calcul de Distance",
    timeCalculation: "Calcul de Temps",
    utmCoordinates: "Coordonnées UTM",
    safetyBuffer: "Tampon de Sécurité",
    gpxParsing: "Analyse GPX",
    pdfExport: "Export PDF",
    
    // Support
    reportIssues: "Signaler des problèmes et suggestions:",
    githubIssuesPage: "Page des Problèmes GitHub",
    
    // Other Tools
    otherTools: "Autres Outils",
    otherToolsDesc: "Outils utiles pour l'édition et la visualisation de fichiers GPX",
    gpxStudio: "GPX Studio",
    gpxStudioDesc: "Éditeur de fichiers GPX en ligne avec capacités de planification d'itinéraires",
    gpsVisualizer: "GPS Visualizer",
    gpsVisualizerDesc: "Outil de création de profils et de visualisation de données",
    
    // About
    packageManager: "Gestionnaire de Paquets",
  },
  
  es: {
    // Header
    appTitle: "Planificador de Rutas de Montaña",
    appDescription: "Planifica tus rutas de montañismo con precisión",
    
    // Buttons
    routeManager: "Gestor de Rutas",
    generalSettings: "Configuración General",
    help: "Ayuda",
    routeSettings: "Configuración de Ruta",
    exportPDF: "Exportar PDF",
    addRoute: "Nueva Ruta",
    close: "Cerrar",
    
    // Route Details
    routeDetails: "Detalles de la Ruta",
    newRoute: "Nueva Ruta",
    waypoints: "puntos de paso",
    uploadGPX: "Sube un archivo GPX para crear una nueva ruta",
    
    // Table Headers
    location: "Ubicación",
    segment: "Segmento",
    route: "Ruta",
    timing: "Cronometraje",
    segmentTime: "Segmento",
    penalty: "Penalización (%)",
    rest: "Descanso (min)",
    total: "Total",
    progression: "Prog.",
    time: "Hora",
    notes: "Notas",
    
    // Route Manager
    manageRoutes: "Gestiona tus rutas guardadas",
    savedRoutes: "Rutas Guardadas",
    noRoutes: "No hay rutas guardadas",
    clickAddRouteToStart: "Haz clic en \"Nueva Ruta\" para empezar",
    deleteRoute: "Eliminar ruta",
    
    // Settings
    defaultSettings: "Configuración por Defecto",
    configureDefaults: "Configura las velocidades y ajustes por defecto para todas las rutas",
    ascentSpeed: "Velocidad de Subida (m/h)",
    descentSpeed: "Velocidad de Bajada (m/h)",
    flatSpeed: "Velocidad en Terreno Llano (m/h)",
    startTime: "Hora de Inicio",
    distanceCalculation: "Cálculo de Distancia",
    safetyTime: "Tiempo de Seguridad (%)",
    useDefaults: "Usar Defectos",
    
    // Help
    technicalDetails: "Detalles Técnicos",
    support: "Soporte",
    about: "Acerca de",
    version: "Versión",
    built: "Construido",
    author: "Autor",
    license: "Licencia",
    
    // Common
    decisionPoint: "Punto de decisión",
    safetyTime: "Tiempo de Seguridad",
    start: "Inicio",
    end: "Final",
    
    // Warning
    betaWarning: "Versión Beta: Los cálculos pueden ser poco fiables y deben ser verificados. Por favor reporta problemas y sugerencias en la",
    issuesPage: "página de problemas de Github",
    
    // Additional UI elements
    language: "Idioma",
    uploadGPXFile: "Subir archivo GPX",
    dropGPXFileHere: "Suelta el archivo GPX aquí",
    dragDropZone: "Arrastra y suelta un archivo GPX aquí, o haz clic para seleccionar",
    selectFile: "Seleccionar Archivo",
    pleaseDropGPXFile: "Por favor suelta un archivo GPX (extensión .gpx)",
    errorParsingGPXFile: "Error al analizar el archivo GPX",
    noFileSelected: "Ningún archivo seleccionado",
    selectedFile: "Archivo seleccionado",
    loadRoute: "Cargar Ruta",
    deleteRoute: "Eliminar Ruta",
    editNotes: "Editar notas",
    noNotes: "Sin notas",
    resetToDefaults: "Restablecer a Defectos",
    routeSpecificSettings: "Configuración Específica de Ruta",
    overrideDefaults: "Configura los ajustes para esta ruta (anula los defectos)",
    
    // Distance calculation options
    trackBased: "Usando la pista",
    waypointToWaypoint: "Punto de paso a punto de paso",
    
    // Technical details
    technicalDetailsDesc: "Información técnica, soporte y detalles de versión",
    distanceCalculationDesc: "Usa la fórmula de Haversine para mediciones de distancia precisas",
    timeCalculationDesc: "Basado en la fórmula t = d/v para diferentes tipos de terreno",
    utmCoordinatesDesc: "Muestra coordenadas en formato Universal Transverse Mercator",
    safetyBufferDesc: "Tiempo de seguridad basado en porcentaje configurable añadido al tiempo total de la ruta",
    gpxParsingDesc: "Soporta cálculos de distancia basados en pista y punto de paso a punto de paso",
    pdfExportDesc: "Genera tarjetas de ruta profesionales con todos los datos de planificación",
    
    // Technical detail labels
    distanceCalculation: "Cálculo de Distancia",
    timeCalculation: "Cálculo de Tiempo",
    utmCoordinates: "Coordenadas UTM",
    safetyBuffer: "Buffer de Seguridad",
    gpxParsing: "Análisis GPX",
    pdfExport: "Exportar PDF",
    
    // Support
    reportIssues: "Reportar problemas y sugerencias:",
    githubIssuesPage: "Página de Problemas de GitHub",
    
    // Other Tools
    otherTools: "Otras Herramientas",
    otherToolsDesc: "Herramientas útiles para edición y visualización de archivos GPX",
    gpxStudio: "GPX Studio",
    gpxStudioDesc: "Editor de archivos GPX en línea con capacidades de planificación de rutas",
    gpsVisualizer: "GPS Visualizer",
    gpsVisualizerDesc: "Herramientas de creación de perfiles y visualización de datos",
    
    // About
    packageManager: "Gestor de Paquetes",
  },
  
  ca: {
    // Header
    appTitle: "Planificador de Rutes de Muntanya",
    appDescription: "Planifica les teves rutes d'alpinisme amb precisió",
    
    // Buttons
    routeManager: "Gestor de Rutes",
    generalSettings: "Configuració General",
    help: "Ajuda",
    routeSettings: "Configuració de Ruta",
    exportPDF: "Exportar PDF",
    addRoute: "Nova Ruta",
    close: "Tancar",
    
    // Route Details
    routeDetails: "Detalls de la Ruta",
    newRoute: "Nova Ruta",
    waypoints: "punts de pas",
    uploadGPX: "Puja un fitxer GPX per crear una nova ruta",
    
    // Table Headers
    location: "Ubicació",
    segment: "Segment",
    route: "Ruta",
    timing: "Cronometratge",
    segmentTime: "Segment",
    penalty: "Penalització (%)",
    rest: "Descans (min)",
    total: "Total",
    progression: "Prog.",
    time: "Hora",
    notes: "Notes",
    
    // Route Manager
    manageRoutes: "Gestiona les teves rutes guardades",
    savedRoutes: "Rutes Guardades",
    noRoutes: "No hi ha rutes guardades",
    clickAddRouteToStart: "Fes clic a \"Nova Ruta\" per començar",
    deleteRoute: "Eliminar ruta",
    
    // Settings
    defaultSettings: "Configuració per Defecte",
    configureDefaults: "Configura les velocitats i ajustos per defecte per a totes les rutes",
    ascentSpeed: "Velocitat de Pujada (m/h)",
    descentSpeed: "Velocitat de Baixada (m/h)",
    flatSpeed: "Velocitat en Terreny Pla (m/h)",
    startTime: "Hora d'Inici",
    distanceCalculation: "Càlcul de Distància",
    safetyTime: "Temps de Seguretat (%)",
    useDefaults: "Usar Defectes",
    
    // Help
    technicalDetails: "Detalls Tècnics",
    support: "Suport",
    about: "Quant a",
    version: "Versió",
    built: "Construït",
    author: "Autor",
    license: "Llicència",
    
    // Common
    decisionPoint: "Punt de decisió",
    safetyTime: "Temps de Seguretat",
    start: "Inici",
    end: "Final",
    
    // Warning
    betaWarning: "Versió Beta: Els càlculs poden ser poc fiables i han de ser verificats. Si us plau reporta problemes i suggeriments a la",
    issuesPage: "pàgina de problemes de Github",
    
    // Additional UI elements
    language: "Idioma",
    uploadGPXFile: "Pujar fitxer GPX",
    dropGPXFileHere: "Deixa anar el fitxer GPX aquí",
    dragDropZone: "Arrossega i deixa anar un fitxer GPX aquí, o fes clic per seleccionar",
    selectFile: "Seleccionar Fitxer",
    pleaseDropGPXFile: "Si us plau deixa anar un fitxer GPX (extensió .gpx)",
    errorParsingGPXFile: "Error en analitzar el fitxer GPX",
    noFileSelected: "Cap fitxer seleccionat",
    selectedFile: "Fitxer seleccionat",
    loadRoute: "Carregar Ruta",
    deleteRoute: "Eliminar Ruta",
    editNotes: "Editar notes",
    noNotes: "Sense notes",
    resetToDefaults: "Restablir a Defectes",
    routeSpecificSettings: "Configuració Específica de Ruta",
    overrideDefaults: "Configura els ajustos per a aquesta ruta (anul·la els defectes)",
    
    // Distance calculation options
    trackBased: "Utilitzant la pista",
    waypointToWaypoint: "Punt de pas a punt de pas",
    
    // Technical details
    technicalDetailsDesc: "Informació tècnica, suport i detalls de versió",
    distanceCalculationDesc: "Utilitza la fórmula de Haversine per a mesuraments de distància precisos",
    timeCalculationDesc: "Basat en la fórmula t = d/v per a diferents tipus de terreny",
    utmCoordinatesDesc: "Mostra coordenades en format Universal Transverse Mercator",
    safetyBufferDesc: "Temps de seguretat basat en percentatge configurable afegit al temps total de la ruta",
    gpxParsingDesc: "Suporta càlculs de distància basats en pista i punt de pas a punt de pas",
    pdfExportDesc: "Genera targetes de ruta professionals amb totes les dades de planificació",
    
    // Technical detail labels
    distanceCalculation: "Càlcul de Distància",
    timeCalculation: "Càlcul de Temps",
    utmCoordinates: "Coordenades UTM",
    safetyBuffer: "Buffer de Seguretat",
    gpxParsing: "Anàlisi GPX",
    pdfExport: "Exportar PDF",
    
    // Support
    reportIssues: "Reportar problemes i suggeriments:",
    githubIssuesPage: "Pàgina de Problemes de GitHub",
    
    // Other Tools
    otherTools: "Altres Eines",
    otherToolsDesc: "Eines útils per a l'edició i visualització de fitxers GPX",
    gpxStudio: "GPX Studio",
    gpxStudioDesc: "Editor de fitxers GPX en línia amb capacitats de planificació d'itineraris",
    gpsVisualizer: "GPS Visualizer",
    gpsVisualizerDesc: "Eines de creació de perfils i visualització de dades",
    
    // About
    packageManager: "Gestor de Paquets",
  }
};

export const languages = {
  en: { name: "English", flag: "🇬🇧" },
  fr: { name: "Français", flag: "🇫🇷" },
  es: { name: "Español", flag: "🇪🇸" },
  ca: { name: "Català", flag: "🇪🇸" }
};
