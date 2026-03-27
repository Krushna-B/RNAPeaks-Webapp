FROM rocker/r-ver:4.3.3

# System dependencies for Bioconductor packages
RUN apt-get update && apt-get install -y \
  libcurl4-openssl-dev \
  libssl-dev \
  libxml2-dev \
  libfontconfig1-dev \
  libharfbuzz-dev \
  libfribidi-dev \
  libfreetype6-dev \
  libpng-dev \
  libtiff5-dev \
  libjpeg-dev \
  libgit2-dev \
  libsodium-dev \
  && rm -rf /var/lib/apt/lists/*

# Install BiocManager + core dependencies
RUN R -e "install.packages('BiocManager', repos='https://cloud.r-project.org')"
RUN R -e "BiocManager::install(c('GenomicRanges', 'AnnotationHub', 'BiocFileCache'), ask=FALSE)"

# Install RNAPeaks from GitHub (pulls all CRAN/Bioc deps automatically)
RUN R -e "install.packages('remotes', repos='https://cloud.r-project.org'); remotes::install_github('Krushna-B/RNAPeaks', dependencies=TRUE)"

# Install plumber
RUN R -e "install.packages('plumber'); library(plumber)"

COPY plumber.R /app/plumber.R

WORKDIR /app

EXPOSE 7860

CMD ["R", "-e", "pr <- plumber::plumb('/app/plumber.R'); pr$run(host='0.0.0.0', port=7860)"]
