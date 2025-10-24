### Batch Validation

The files used in the batch processing test can be found in the *test-batch* folder.

The *pc-hgnc.gmt* file includes information on pathways in Pathway Commons v14, available from https://download.baderlab.org/PathwayCommons/PC2/v14/.

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

### Automated Validation and Resolution

A number of Reactome Pathways (that can be found in the *test-resolve/samples* folder) were used for evaluating automated validation and resolution capabilities of SyBVaLS.

First, some errors were randomly introduced to deliberately violate the SBGN rules. Then, each such map was processed by SyBValS to validate and automatically correct those errors. We measured what percentage of the errors were identified, as well as what percentage was correctly fixed by the default fix choice.

The test generates two output files for each pathway:
- a text file containing error information, and
- an SBGN file containing information about the final map after automatic error resolution

#### How to run
While inside the test folder:

- Run the service locally at http://localhost:3400.
- Execute the script using the command:
  ```node validateAndResolveMaps.js```
- The produced SBGN files and the generated *.txt* files should be saved in a *results* folder.
