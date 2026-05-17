# Script to create sample events
$headers = @{
    'Content-Type' = 'application/json'
}

$events = @(
    @{
        titre = "Conférence Tech 2024"
        description = "Une conférence sur les dernières technologies"
        dateDebut = "2024-08-15T09:00:00Z"
        dateFin = "2024-08-15T17:00:00Z"
        lieu = "Centre de Conférences Tunis"
        placesMax = 100
        prix = 50
        categorie = "Technologie"
        statut = "planifie"
    },
    @{
        titre = "Atelier de Formation"
        description = "Formation pratique sur le développement web"
        dateDebut = "2024-08-20T10:00:00Z"
        dateFin = "2024-08-20T16:00:00Z"
        lieu = "Salle de Formation A"
        placesMax = 30
        prix = 25
        categorie = "Formation"
        statut = "planifie"
    },
    @{
        titre = "Événement Gratuit"
        description = "Rencontre communautaire gratuite"
        dateDebut = "2024-08-25T14:00:00Z"
        dateFin = "2024-08-25T18:00:00Z"
        lieu = "Parc Central"
        placesMax = 200
        prix = 0
        categorie = "Communauté"
        statut = "actif"
    }
)

foreach ($event in $events) {
    $body = $event | ConvertTo-Json
    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:5001/api/events" -Method Post -Headers $headers -Body $body
        Write-Host "Événement créé: $($event.titre)" -ForegroundColor Green
    }
    catch {
        Write-Host "Erreur lors de la création de l'événement: $($event.titre)" -ForegroundColor Red
        Write-Host $_.Exception.Message
    }
}
