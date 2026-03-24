release: python backend/manage.py migrate
web: gunicorn config.wsgi --chdir backend --log-file -
