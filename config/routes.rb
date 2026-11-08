Rails.application.routes.draw do
  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  get "up" => "rails/health#show", as: :rails_health_check

  resources :contacts, only: %i[index destroy] do
    collection do
      post :restore
      # One chunk of a side-index letter section, lazy-loaded into the list ("other" = "#").
      get "letters/:letter", action: :section, as: :section, constraints: { letter: /[A-Z]|other/ }
    end
  end

  root "contacts#index"
end
