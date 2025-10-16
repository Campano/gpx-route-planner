/**
 * Internationalization translations
 */

export const translations = {
  en: {
    // Header
    appTitle: "Mountain Route Planner",
    appDescription: "Plan your mountaineering routes with precision",
    
    // Buttons
    routeManager: "Routes",
    generalSettings: "Settings",
    help: "Help",
    routeSettings: "Configuration",
    routeConfiguration: "Route Configuration",
    routeSettingsDesc: "Configure settings for \"{routeName}\" (overrides default)",
    routeSpecificSettings: "Route-specific settings",
    ascentSpeedLabel: "Ascent Speed (m/h)",
    descentSpeedLabel: "Descent Speed (m/h)",
    flatSpeedLabel: "Flat Speed (m/h)",
    startingTimeLabel: "Starting Time",
    safetyTimeLabel: "Safety Time (%)",
    distanceCalculation: "Distance Calculation",
    trackBased: "Track-based (recommended)",
    waypointToWaypoint: "Waypoint to waypoint",
    trackBasedDesc: "Uses actual track path for accurate distances",
    waypointToWaypointDesc: "Uses straight-line distance between waypoints",
    routeStatistics: "Route Statistics",
    startingTime: "Starting Time",
    endingTime: "Ending Time",
    duration: "Duration",
    speedSettings: "Speed Settings",
    utmZones: "UTM Zone",
    distance: "Distance",
    ascent: "Ascent",
    descent: "Descent",
    maxElevation: "Max Elevation",
    exportPDF: "Export PDF",
    addRoute: "New Route",
    addRouteTitle: "Add Route",
    close: "Close",
    
    // Route Details
    routeDetails: "Route Details",
    newRoute: "New Route",
    waypoints: "waypoints",
    uploadGPX: "Upload a GPX file to create a new route",
    noRouteSelected: "No Route Selected",
    noRouteSelectedDesc: "Select a route from the Routes panel or upload a new GPX file",
    viewRoutes: "View Routes",
    
    // Table Headers
    waypoint: "Waypoint",
    distance: "Distance",
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
    
    // Activity modes
    activityMode: "Activity Mode",
    hiking: "Hiking",
    snowshoes: "Snowshoes",
    skiTouring: "Ski Touring",
    
    // Data management
    cleanAllData: "Clean All Data",
    cleanAllDataConfirm: "Are you sure?",
    cleanAllDataMessage: "This will permanently delete all saved routes and personal settings. This action cannot be undone.",
    deleteRoute: "Delete Route",
    deleteRouteConfirm: "Delete this route?",
    deleteRouteMessage: "This will permanently delete the selected route. This action cannot be undone.",
    deleteRouteConfirmTooltip: "Click here to confirm that you want to delete this route and all its data",
    activityModeChangeMessage: "Changing the activity mode will reset your custom speeds to the default values for this mode. Your custom speed modifications will be lost.",
    confirmActivityModeChange: "Confirm Activity Change",
    exportCSV: "Export CSV",
    exportCSVDesc: "Export route data as CSV with units in headers",
    confirm: "Confirm",
    cancel: "Cancel",
    
    // Donation
    donate: "Donate",
    donateDesc: "Support the development of this project",
    donateMessage: "If you find this tool useful, consider supporting its development. Your contribution helps keep the project alive and enables new features."
  },
  
  fr: {
    // Header
    appTitle: "Planificateur de Routes Montagne",
    appDescription: "Planifiez vos routes d'alpinisme avec précision",
    
    // Buttons
    routeManager: "Routes",
    generalSettings: "Paramètres",
    help: "Aide",
    routeSettings: "Configuration",
    routeConfiguration: "Configuration de Route",
    routeSettingsDesc: "Configurer les paramètres pour \"{routeName}\" (remplace les valeurs par défaut)",
    routeSpecificSettings: "Paramètres spécifiques à la route",
    ascentSpeedLabel: "Vitesse de Montée (m/h)",
    descentSpeedLabel: "Vitesse de Descente (m/h)",
    flatSpeedLabel: "Vitesse sur Terrain Plat (m/h)",
    startingTimeLabel: "Heure de Départ",
    safetyTimeLabel: "Temps de Sécurité (%)",
    distanceCalculation: "Calcul de Distance",
    trackBased: "Basé sur la piste (recommandé)",
    waypointToWaypoint: "Point à point",
    trackBasedDesc: "Utilise le chemin réel de la piste pour des distances précises",
    waypointToWaypointDesc: "Utilise la distance en ligne droite entre les points",
    routeStatistics: "Statistiques de Route",
    startingTime: "Heure de Départ",
    endingTime: "Heure d'Arrivée",
    duration: "Durée",
    speedSettings: "Paramètres de Vitesse",
    utmZones: "Zone UTM",
    distance: "Distance",
    ascent: "Montée",
    descent: "Descente",
    maxElevation: "Altitude Max",
    exportPDF: "Exporter PDF",
    addRoute: "Nouvelle Route",
    addRouteTitle: "Ajouter Route",
    close: "Fermer",
    
    // Route Details
    routeDetails: "Détails de la Route",
    newRoute: "Nouvelle Route",
    waypoints: "points de passage",
    uploadGPX: "Téléchargez un fichier GPX pour créer une nouvelle route",
    noRouteSelected: "Aucune Route Sélectionnée",
    noRouteSelectedDesc: "Sélectionnez une route dans le panneau Routes ou téléchargez un nouveau fichier GPX",
    viewRoutes: "Voir les Routes",
    
    // Table Headers
    waypoint: "Point de Passage",
    distance: "Distance",
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
    
    // Activity modes
    activityMode: "Mode d'Activité",
    hiking: "Randonnée",
    snowshoes: "Raquettes",
    skiTouring: "Ski de Randonnée",
    
    // Data management
    cleanAllData: "Effacer Toutes les Données",
    cleanAllDataConfirm: "Êtes-vous sûr ?",
    cleanAllDataMessage: "Cela supprimera définitivement toutes les routes sauvegardées et les paramètres personnels. Cette action ne peut pas être annulée.",
    deleteRoute: "Supprimer la Route",
    deleteRouteConfirm: "Supprimer cette route ?",
    deleteRouteMessage: "Cela supprimera définitivement la route sélectionnée. Cette action ne peut pas être annulée.",
    deleteRouteConfirmTooltip: "Cliquez ici pour confirmer que vous voulez supprimer cette route et toutes ses données",
    activityModeChangeMessage: "Changer le mode d'activité réinitialisera vos vitesses personnalisées aux valeurs par défaut pour ce mode. Vos modifications de vitesse personnalisées seront perdues.",
    confirmActivityModeChange: "Confirmer le Changement d'Activité",
    exportCSV: "Exporter CSV",
    exportCSVDesc: "Exporter les données de route en CSV avec les unités dans les en-têtes",
    confirm: "Confirmer",
    cancel: "Annuler",
    
    // Donation
    donate: "Faire un don",
    donateDesc: "Soutenir le développement de ce projet",
    donateMessage: "Si vous trouvez cet outil utile, envisagez de soutenir son développement. Votre contribution aide à maintenir le projet en vie et permet de nouvelles fonctionnalités."
  },
  
  es: {
    // Header
    appTitle: "Planificador de Rutas de Montaña",
    appDescription: "Planifica tus rutas de montañismo con precisión",
    
    // Buttons
    routeManager: "Rutas",
    generalSettings: "Configuración",
    help: "Ayuda",
    routeSettings: "Ajustes",
    routeConfiguration: "Configuración de Ruta",
    routeSettingsDesc: "Configurar ajustes para \"{routeName}\" (anula los valores por defecto)",
    routeSpecificSettings: "Configuración específica de la ruta",
    ascentSpeedLabel: "Velocidad de Ascenso (m/h)",
    descentSpeedLabel: "Velocidad de Descenso (m/h)",
    flatSpeedLabel: "Velocidad en Terreno Plano (m/h)",
    startingTimeLabel: "Hora de Inicio",
    safetyTimeLabel: "Tiempo de Seguridad (%)",
    distanceCalculation: "Cálculo de Distancia",
    trackBased: "Basado en pista (recomendado)",
    waypointToWaypoint: "Punto a punto",
    trackBasedDesc: "Utiliza la ruta real de la pista para distancias precisas",
    waypointToWaypointDesc: "Utiliza la distancia en línea recta entre puntos",
    routeStatistics: "Estadísticas de Ruta",
    startingTime: "Hora de Inicio",
    endingTime: "Hora de Llegada",
    duration: "Duración",
    speedSettings: "Configuración de Velocidad",
    utmZones: "Zonas UTM",
    distance: "Distancia",
    ascent: "Ascenso",
    descent: "Descenso",
    maxElevation: "Altitud Máxima",
    exportPDF: "Exportar PDF",
    addRoute: "Nueva Ruta",
    addRouteTitle: "Agregar Ruta",
    close: "Cerrar",
    
    // Route Details
    routeDetails: "Detalles de la Ruta",
    newRoute: "Nueva Ruta",
    waypoints: "puntos de paso",
    uploadGPX: "Sube un archivo GPX para crear una nueva ruta",
    noRouteSelected: "Ninguna Ruta Seleccionada",
    noRouteSelectedDesc: "Selecciona una ruta del panel de Rutas o sube un nuevo archivo GPX",
    viewRoutes: "Ver Rutas",
    
    // Table Headers
    waypoint: "Punto de Paso",
    distance: "Distancia",
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
    
    // Activity modes
    activityMode: "Modo de Actividad",
    hiking: "Senderismo",
    snowshoes: "Raquetas de Nieve",
    skiTouring: "Esquí de Travesía",
    
    // Data management
    cleanAllData: "Limpiar Todos los Datos",
    cleanAllDataConfirm: "¿Estás seguro?",
    cleanAllDataMessage: "Esto eliminará permanentemente todas las rutas guardadas y configuraciones personales. Esta acción no se puede deshacer.",
    deleteRoute: "Eliminar Ruta",
    deleteRouteConfirm: "¿Eliminar esta ruta?",
    deleteRouteMessage: "Esto eliminará permanentemente la ruta seleccionada. Esta acción no se puede deshacer.",
    deleteRouteConfirmTooltip: "Haz clic aquí para confirmar que quieres eliminar esta ruta y todos sus datos",
    activityModeChangeMessage: "Cambiar el modo de actividad restablecerá tus velocidades personalizadas a los valores por defecto para este modo. Tus modificaciones de velocidad personalizadas se perderán.",
    confirmActivityModeChange: "Confirmar Cambio de Actividad",
    exportCSV: "Exportar CSV",
    exportCSVDesc: "Exportar datos de ruta como CSV con unidades en los encabezados",
    confirm: "Confirmar",
    cancel: "Cancelar",
    
    // Donation
    donate: "Donar",
    donateDesc: "Apoyar el desarrollo de este proyecto",
    donateMessage: "Si encuentras útil esta herramienta, considera apoyar su desarrollo. Tu contribución ayuda a mantener el proyecto vivo y permite nuevas características."
  },
  
  ca: {
    // Header
    appTitle: "Planificador de Rutes de Muntanya",
    appDescription: "Planifica les teves rutes d'alpinisme amb precisió",
    
    // Buttons
    routeManager: "Rutes",
    generalSettings: "Configuració",
    help: "Ajuda",
    routeSettings: "Ajustos",
    routeConfiguration: "Configuració de Ruta",
    routeSettingsDesc: "Configurar ajustos per a \"{routeName}\" (anula els valors per defecte)",
    routeSpecificSettings: "Configuració específica de la ruta",
    ascentSpeedLabel: "Velocitat d'Ascens (m/h)",
    descentSpeedLabel: "Velocitat de Descens (m/h)",
    flatSpeedLabel: "Velocitat en Terreny Plà (m/h)",
    startingTimeLabel: "Hora d'Inici",
    safetyTimeLabel: "Temps de Seguretat (%)",
    distanceCalculation: "Càlcul de Distància",
    trackBased: "Basat en pista (recomanat)",
    waypointToWaypoint: "Punt a punt",
    trackBasedDesc: "Utilitza el camí real de la pista per distàncies precises",
    waypointToWaypointDesc: "Utilitza la distància en línia recta entre punts",
    routeStatistics: "Estadístiques de Ruta",
    startingTime: "Hora d'Inici",
    endingTime: "Hora d'Arribada",
    duration: "Durada",
    speedSettings: "Configuració de Velocitat",
    utmZones: "Zone UTM",
    distance: "Distància",
    ascent: "Ascens",
    descent: "Descens",
    maxElevation: "Altitud Màxima",
    exportPDF: "Exportar PDF",
    addRoute: "Nova Ruta",
    addRouteTitle: "Afegir Ruta",
    close: "Tancar",
    
    // Route Details
    routeDetails: "Detalls de la Ruta",
    newRoute: "Nova Ruta",
    waypoints: "punts de pas",
    uploadGPX: "Puja un fitxer GPX per crear una nova ruta",
    noRouteSelected: "Cap Ruta Seleccionada",
    noRouteSelectedDesc: "Selecciona una ruta del panell de Rutes o puja un nou fitxer GPX",
    viewRoutes: "Veure Rutes",
    
    // Table Headers
    waypoint: "Punt de Pas",
    distance: "Distància",
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
    
    // Activity modes
    activityMode: "Mode d'Activitat",
    hiking: "Senderisme",
    snowshoes: "Raquetes de Neu",
    skiTouring: "Esquí de Travessa",
    
    // Data management
    cleanAllData: "Netejar Totes les Dades",
    cleanAllDataConfirm: "Estàs segur?",
    cleanAllDataMessage: "Això eliminarà permanentment totes les rutes desades i configuracions personals. Aquesta acció no es pot desfer.",
    deleteRoute: "Eliminar Ruta",
    deleteRouteConfirm: "Eliminar aquesta ruta?",
    deleteRouteMessage: "Això eliminarà permanentment la ruta seleccionada. Aquesta acció no es pot desfer.",
    deleteRouteConfirmTooltip: "Feu clic aquí per confirmar que voleu eliminar aquesta ruta i totes les seves dades",
    activityModeChangeMessage: "Canviar el mode d'activitat restablirà les vostres velocitats personalitzades als valors per defecte per a aquest mode. Les vostres modificacions de velocitat personalitzades es perdran.",
    confirmActivityModeChange: "Confirmar Canvi d'Activitat",
    exportCSV: "Exportar CSV",
    exportCSVDesc: "Exportar dades de ruta com CSV amb unitats als encapçalats",
    confirm: "Confirmar",
    cancel: "Cancel·lar",
    
    // Donation
    donate: "Donar",
    donateDesc: "Suportar el desenvolupament d'aquest projecte",
    donateMessage: "Si trobes útil aquesta eina, considera suportar-ne el desenvolupament. La teva contribució ajuda a mantenir el projecte viu i permet noves funcionalitats."
  }
};

export const languages = {
  en: { name: "English", flag: "🇬🇧" },
  fr: { name: "Français", flag: "🇫🇷" },
  es: { name: "Español", flag: "🇪🇸" },
  ca: { name: "Català", flag: "🇪🇸" }
};
