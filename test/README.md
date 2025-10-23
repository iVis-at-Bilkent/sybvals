### Batch Processing

The files used in batch processing test can be found in *test-batch* folder.

The *pc-hgnc.gmt* file includes information of pathways in Pathway Commons v14, available from https://download.baderlab.org/PathwayCommons/PC2/v14/.

The *config.json* file includes image options used by SyBValS.

The *sybvals_batch.py* script runs validation on the pathways listed in the *pc-hgnc.gmt* file, using the options specified in *config.json*. 
Please note that this script processes only pathways with identifier links from the Reactome, KEGG, PathBank, and Panther databases. The script first downloads the SBGN file of each pathway, then sends a query to the SyBValS service using the SBGN file and options data. It generates two output files for each pathway:
- a text file containing error information, and
- a PNG image highlighting the errors in the pathway.

#### How to run
While inside the *test-batch* folder:

- Create a folder named *Batch* to store the resulting files.
- Run the service locally at http://localhost:3400.
- Execute the script using the command:
  ```python3 sybvals_batch.py```
- The downloaded SBGN files and the generated .txt and .png files will be saved in the *Batch* folder.
