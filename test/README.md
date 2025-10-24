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
### Reactome Pathways Processing

The files used for testing Reactome Pathways which are valid in terms of SBGN rules can be in *samples* folder.

They are tested by introducing errors by randomly violating SBGN rules. Then, they are sent to SyBValS for resolving errors to assess accuracy and efficiency of SyBValS.
It generates two output files for each pathway:
- a text file containing error information, and
- a SBGN file containing information of final map after resolving errors.

#### How to run
While inside the test folder:

- Run the service locally at http://localhost:3400.
- Execute the script using the command:
  ```node batchReactomeMaps.js```
- The produced SBGN files and the generated .txt files will be saved in the *results* folder.

I
